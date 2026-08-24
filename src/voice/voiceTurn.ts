import { VoiceError, voiceError, type RecordedAudio, type VoiceProvider } from './types';
import { MIN_RECORDING_MS } from './types';

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
  const { provider, sendToBrain, play, onStage, onTranscript, onError } = deps;

  if (!provider.isAvailable) {
    onError(voiceError('unavailable'));
    onStage('idle');
    return null;
  }

  if (audio.durationMs < MIN_RECORDING_MS) {
    onError(voiceError('tooShort'));
    onStage('idle');
    return null;
  }

  let transcript: string;
  try {
    onStage('transcribing');
    transcript = (await provider.transcribe(audio)).trim();
  } catch (thrown) {
    onError(asVoiceError(thrown, 'transcribeFailed'));
    onStage('idle');
    return null;
  }

  if (transcript.length === 0) {
    onError(voiceError('noSpeech'));
    onStage('idle');
    return null;
  }

  onTranscript?.(transcript);

  let reply: string | null;
  try {
    onStage('thinking');
    reply = await sendToBrain(transcript);
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
  try {
    onStage('speaking');
    const speech = await provider.synthesize(reply);
    await play(speech.uri);
  } catch (thrown) {
    onError(asVoiceError(thrown, 'speakFailed'));
  } finally {
    onStage('idle');
  }

  return transcript;
}

function asVoiceError(thrown: unknown, fallback: Parameters<typeof voiceError>[0]): VoiceError {
  return thrown instanceof VoiceError ? thrown : voiceError(fallback, thrown);
}
