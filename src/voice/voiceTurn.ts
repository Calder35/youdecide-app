import { VoiceError, voiceError, type RecordedAudio, type VoiceProvider } from './types';
import { MIN_AUDIO_BYTES, MIN_RECORDING_MS } from './types';
import { createSpeechQueue } from './speechQueue';

/**
 * One spoken turn, as a pure function of its dependencies.
 *
 *   hold the mic → speech → text → the /v1/chat brain → text → speech
 *
 * The native pieces (recorder, player) are injected, so the whole sequence —
 * including every way it can fail — is testable without a device. That matters
 * more than usual here: the failure paths are the ones a person in a difficult
 * conversation will actually hit, and they are the hardest to exercise by hand.
 *
 * THE RULE THIS ENCODES: a voice failure never costs the person their words.
 * Once speech has become text, that text goes to the brain even if speaking the
 * reply out loud fails afterwards. Losing what someone just said because a TTS
 * call 500'd would be unforgivable.
 */

export type VoiceTurnStage =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

export type VoiceTurnDeps = {
  provider: VoiceProvider;
  /** Hands the transcript to the existing chat brain; resolves with the reply. */
  sendToBrain: (transcript: string) => Promise<string | null>;
  /**
   * The streaming brain, when there is one.
   *
   * Same job as `sendToBrain`, except it calls back with each sentence as the
   * model writes it and resolves with the whole reply at the end. When present
   * it is preferred, because it is what lets speech start before the reply is
   * finished; when absent the turn behaves exactly as it always has.
   *
   * A failure here does NOT fall back to `sendToBrain`. Sending the same turn
   * twice would charge the person two answers to one question, and the second
   * would arrive after they had already heard part of the first.
   */
  streamToBrain?: (
    transcript: string,
    onSentence: (sentence: string) => void,
  ) => Promise<string | null>;
  play: (uri: string) => Promise<void>;
  onStage: (stage: VoiceTurnStage) => void;
  /** Shows the transcript in the conversation before the brain answers. */
  onTranscript?: (transcript: string) => void;
  onError: (error: VoiceError) => void;
  /** Bytes on disk, so a silent capture is caught before it is uploaded. */
  measureBytes?: (uri: string) => Promise<number>;
  /** Diagnostics. Duration and size are what tell us what the mic really did. */
  log?: (message: string) => void;
  /** Wall clock, injectable so timing assertions are deterministic in tests. */
  now?: () => number;
  /** Per-stage milliseconds, reported once the turn is done. */
  onTiming?: (timing: VoiceTurnTiming) => void;
};

/**
 * Where a spoken turn's seconds actually go.
 *
 * Reported per turn because "it's slow" is not actionable and
 * "stt=1.0s chat=3.8s tts=1.4s" is. `toFirstSoundMs` is the number a person
 * feels: the silence between them finishing and the reply starting. It is
 * reported AT the first sound rather than at the end of the turn, because
 * everything after that point is the reply playing, which is not waiting.
 */
export type VoiceTurnTiming = {
  /** Upload, recognise, come back. */
  sttMs: number;
  /** The brain. Usually the largest of the three, and not ours to shorten. */
  chatMs: number;
  /** Synthesising the FIRST chunk — what stands between them and hearing it. */
  ttsFirstChunkMs: number;
  /** Stop-of-recording to first audible sound. The whole felt delay. */
  toFirstSoundMs: number;
  /** How many pieces the reply was split into. */
  chunkCount: number;
};

/**
 * Runs everything after the mic stops.
 *
 * Returns the transcript when one was produced, so a caller can tell "nothing
 * was said" from "something was said and the rest went wrong".
 */
export async function runVoiceTurn(
  audio: RecordedAudio,
  deps: VoiceTurnDeps,
): Promise<string | null> {
  const { provider, sendToBrain, onStage, onTranscript, onError } = deps;
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  let sttMs = 0;
  let chatMs = 0;

  if (!provider.isAvailable) {
    onError(voiceError('unavailable'));
    onStage('idle');
    return null;
  }

  if (audio.durationMs < MIN_RECORDING_MS) {
    deps.log?.(`voice: too short — ${audio.durationMs}ms`);
    onError(voiceError('tooShort'));
    onStage('idle');
    return null;
  }

  // VERIFY THE CAPTURE BEFORE SPENDING A REQUEST ON IT. A file that exists but
  // holds no audio is the failure that made voice look broken: an empty m4a
  // still has a container header, so "the file is there" proves nothing.
  if (deps.measureBytes !== undefined) {
    const bytes = await deps.measureBytes(audio.uri);
    deps.log?.(`voice: captured ${audio.durationMs}ms, ${bytes} bytes, ${audio.mimeType}`);
    if (bytes < MIN_AUDIO_BYTES) {
      onError(voiceError('silent'));
      onStage('idle');
      return null;
    }
  } else {
    deps.log?.(`voice: captured ${audio.durationMs}ms, ${audio.mimeType}`);
  }

  let transcript: string;
  try {
    onStage('transcribing');
    const sttStarted = now();
    transcript = (await provider.transcribe(audio)).trim();
    sttMs = now() - sttStarted;
    deps.log?.(`voice: transcript ${transcript.length} chars`);
  } catch (thrown) {
    const failure = asVoiceError(thrown, 'transcribeFailed');
    deps.log?.(`voice: transcribe failed — ${failure.kind}: ${String(failure.cause ?? failure.message)}`);
    onError(failure);
    onStage('idle');
    return null;
  }

  if (transcript.length === 0) {
    // The capture had audio in it and the service still heard no words. Worth
    // logging as distinct from a failed request — it points at the recording,
    // not the network.
    deps.log?.('voice: transcript empty despite a non-empty recording');
    onError(voiceError('noSpeech'));
    onStage('idle');
    return null;
  }

  onTranscript?.(transcript);

  /**
   * The speech queue is opened BEFORE the brain is asked.
   *
   * That ordering is the whole streaming change. Sentences can be handed
   * straight to it as they are written, so synthesis of the first one overlaps
   * generation of the second, instead of the person waiting out the entire
   * reply in silence first.
   */
  let firstSoundAt: number | null = null;
  const queue = createSpeechQueue({
    synthesize: (text) => provider.synthesize(text),
    play: deps.play,
    onError,
    log: deps.log,
    now,
    onFirstSound: (ttsFirstChunkMs, pieces) => {
      firstSoundAt = now();
      const toFirstSoundMs = firstSoundAt - startedAt;
      deps.onTiming?.({ sttMs, chatMs, ttsFirstChunkMs, toFirstSoundMs, chunkCount: pieces });
      deps.log?.(
        `voice: timing stt=${sttMs}ms chat=${chatMs}ms tts1=${ttsFirstChunkMs}ms ` +
          `(${pieces} chunk${pieces === 1 ? '' : 's'}) → first sound ${toFirstSoundMs}ms ` +
          'after the mic stopped',
      );
    },
  });

  let reply: string | null;
  const chatStarted = now();
  try {
    onStage('thinking');
    if (deps.streamToBrain !== undefined) {
      // The stage flips to 'speaking' on the FIRST sentence rather than after
      // the whole reply — otherwise the screen would still say "Thinking about
      // it…" while it was audibly talking.
      let spokenYet = false;
      reply = await deps.streamToBrain(transcript, (sentence) => {
        if (!spokenYet) {
          spokenYet = true;
          chatMs = now() - chatStarted;
          onStage('speaking');
        }
        queue.push(sentence);
      });
      if (!spokenYet) chatMs = now() - chatStarted;
    } else {
      reply = await sendToBrain(transcript);
      chatMs = now() - chatStarted;
    }
  } catch (thrown) {
    // The brain failing is the chat layer's problem to report — it already
    // shows its own error and offers a retry. Voice does not double up on it.
    queue.cancel();
    onStage('idle');
    throw thrown;
  }

  if (reply === null || reply.trim().length === 0) {
    queue.cancel();
    onStage('idle');
    return transcript;
  }

  // From here, the person's words are safely in the conversation. Anything that
  // fails below costs them audio, not meaning — so it is reported gently and
  // the turn still counts as a success.
  onStage('speaking');
  // Streaming already pushed each sentence as it landed; pushing the assembled
  // reply again would say the whole thing twice.
  if (deps.streamToBrain === undefined) queue.push(reply);
  queue.end();
  await queue.done;
  onStage('idle');

  return transcript;
}

function asVoiceError(thrown: unknown, fallback: Parameters<typeof voiceError>[0]): VoiceError {
  return thrown instanceof VoiceError ? thrown : voiceError(fallback, thrown);
}
