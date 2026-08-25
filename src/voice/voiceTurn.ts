import { VoiceError, voiceError, type RecordedAudio, type VoiceProvider } from './types';
import { MIN_AUDIO_BYTES, MIN_RECORDING_MS } from './types';
import { splitForSpeech } from './speechChunks';

/**
 * One spoken turn, as a pure function of its dependencies.
 *
 *   hold the mic → speech → text → the existing /v1/chat brain → text → speech
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

  let reply: string | null;
  const chatStarted = now();
  try {
    onStage('thinking');
    reply = await sendToBrain(transcript);
    chatMs = now() - chatStarted;
  } catch (thrown) {
    // The brain failing is the chat layer's problem to report — it already
    // shows its own error and offers a retry. Voice does not double up on it.
    onStage('idle');
    throw thrown;
  }

  if (reply === null || reply.trim().length === 0) {
    onStage('idle');
    return transcript;
  }

  // From here, the person's words are safely in the conversation. Anything that
  // fails below costs them audio, not meaning — so it is reported gently and
  // the turn still counts as a success.
  onStage('speaking');
  await speakInChunks(reply, deps, {
    now,
    onFirstSound: (ttsFirstChunkMs, chunkCount) => {
      const toFirstSoundMs = now() - startedAt;
      deps.onTiming?.({ sttMs, chatMs, ttsFirstChunkMs, toFirstSoundMs, chunkCount });
      deps.log?.(
        `voice: timing stt=${sttMs}ms chat=${chatMs}ms tts1=${ttsFirstChunkMs}ms ` +
          `(${chunkCount} chunk${chunkCount === 1 ? '' : 's'}) → first sound ${toFirstSoundMs}ms ` +
          'after the mic stopped',
      );
    },
  });
  onStage('idle');

  return transcript;
}

/**
 * How many chunks are kept in flight ahead of the one being spoken.
 *
 * One was not enough. With a lookahead of one, chunk N+1's synthesis begins
 * only when chunk N is ready to play — so a chunk that takes longer to
 * synthesise than the previous one takes to say leaves a gap mid-reply. Two in
 * flight covers that, and beyond two the requests just queue behind speech that
 * has not been said yet.
 */
const SYNTHESIS_LOOKAHEAD = 2;

/**
 * Speaks a reply a sentence at a time, synthesising ahead while it plays.
 *
 * The pipeline is the point. Later chunks are requested BEFORE the current one
 * plays, so the network work happens during the audio rather than before it. A
 * person hears the first sentence in about a second and a half instead of
 * waiting out the whole reply — 37 seconds, at the top end we measured.
 */
async function speakInChunks(
  reply: string,
  deps: VoiceTurnDeps,
  timing: { now: () => number; onFirstSound: (ttsMs: number, chunkCount: number) => void },
): Promise<void> {
  const { provider, play, onError } = deps;
  const chunks = splitForSpeech(reply);

  deps.log?.(`voice: speaking ${reply.length} chars in ${chunks.length} chunk(s)`);

  /** One chunk, with a single retry — a blip should cost nothing visible. */
  const synthesize = (chunk: string) =>
    withOneRetry(
      () => provider.synthesize(chunk),
      (error) => deps.log?.(`voice: synthesize failed, retrying once — ${describe(error)}`),
    );

  const inFlight: (Promise<{ uri: string }> | null)[] = chunks.map(() => null);

  /** Starts a chunk synthesising, if it exists and has not been started. */
  const requestChunk = (index: number) => {
    if (index >= chunks.length || inFlight[index] !== null) return;
    const request = synthesize(chunks[index]);
    // A chunk we may never reach — because an earlier one failed — must not
    // surface as an unhandled rejection. Awaiting it below still throws.
    request.catch(() => undefined);
    inFlight[index] = request;
  };

  const speakStarted = timing.now();
  for (let ahead = 0; ahead < SYNTHESIS_LOOKAHEAD; ahead += 1) requestChunk(ahead);
  let spoken = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    requestChunk(index);
    const current = inFlight[index];
    if (current === null) break;

    let audio;
    try {
      audio = await current;
    } catch (thrown) {
      report(thrown, index);
      return;
    }

    // Top the queue back up before playing, so the requests and the audio
    // overlap rather than alternate.
    for (let ahead = 1; ahead <= SYNTHESIS_LOOKAHEAD; ahead += 1) requestChunk(index + ahead);

    try {
      if (index === 0) timing.onFirstSound(timing.now() - speakStarted, chunks.length);
      await play(audio.uri);
      spoken += 1;
    } catch (thrown) {
      report(thrown, index);
      return;
    }
  }

  deps.log?.('voice: turn complete');

  function report(thrown: unknown, index: number) {
    // Anything already spoken is worth distinguishing from nothing spoken: one
    // is a reply that stopped early, the other is a reply that never started.
    const kind = spoken > 0 ? 'speakCutShort' : 'speakFailed';
    const failure = asVoiceError(thrown, kind);
    deps.log?.(
      `voice: speak failed on chunk ${index + 1}/${chunks.length} after ${spoken} spoken — ${describe(
        failure.cause ?? failure,
      )}`,
    );
    onError(failure);
  }
}

function asVoiceError(thrown: unknown, fallback: Parameters<typeof voiceError>[0]): VoiceError {
  return thrown instanceof VoiceError ? thrown : voiceError(fallback, thrown);
}

/** Runs `attempt`, and on failure runs it once more. */
async function withOneRetry<T>(
  attempt: () => Promise<T>,
  onRetry: (error: unknown) => void,
): Promise<T> {
  try {
    return await attempt();
  } catch (thrown) {
    onRetry(thrown);
    return attempt();
  }
}

/** A readable one-liner for a log, whatever was thrown. */
function describe(thrown: unknown): string {
  if (thrown instanceof VoiceError) return `${thrown.kind}: ${thrown.message}`;
  if (thrown instanceof Error) return thrown.message;
  return String(thrown);
}
