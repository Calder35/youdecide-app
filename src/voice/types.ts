/**
 * The voice seam.
 *
 * Everything above this interface — the mic button, the turn machine, the
 * screen — is provider-agnostic. Swapping ElevenLabs for OpenAI, Deepgram, or
 * anything else means writing one new `VoiceProvider` and changing which one is
 * constructed. Nothing else moves.
 *
 * The seam is deliberately BORING: two calls, both file-in / file-out, both
 * async, no streaming. A turn-based conversation does not need a realtime
 * socket, and not needing one is what keeps this working inside Expo Go.
 */

/** What the mic produced: a local file the provider can upload. */
export type RecordedAudio = {
  /** file:// URI on the device. */
  uri: string;
  /** Milliseconds. Used to reject taps too short to contain speech. */
  durationMs: number;
  /** e.g. 'audio/m4a' — what the recorder actually wrote. */
  mimeType: string;
};

/** What the provider produced: a local file the player can play. */
export type SpeakableAudio = {
  /** file:// URI on the device. */
  uri: string;
  mimeType: string;
};

export type VoiceProvider = {
  /** A name for logs and the "voice is unavailable" copy. */
  readonly name: string;
  /** False when this build cannot do voice at all (offline, no backend). */
  readonly isAvailable: boolean;
  /** Speech in, text out. */
  transcribe(audio: RecordedAudio): Promise<string>;
  /** Text in, speech out, written to a local file. */
  synthesize(text: string): Promise<SpeakableAudio>;
};

/**
 * Voice failures a person can act on.
 *
 * Same rule as the rest of the app: say what happened and what to do. Voice has
 * one extra obligation — every failure must leave the person able to TYPE. A
 * broken mic is an inconvenience; a broken mic that also strands the
 * conversation is a wall.
 */
export type VoiceFailureKind =
  | 'unavailable'
  | 'permissionDenied'
  | 'tooShort'
  | 'noSpeech'
  | 'transcribeFailed'
  | 'speakFailed'
  | 'recordFailed';

export class VoiceError extends Error {
  readonly kind: VoiceFailureKind;
  /** Safe to render. Always ends by pointing back at typing. */
  readonly personMessage: string;

  constructor(kind: VoiceFailureKind, personMessage: string, cause?: unknown) {
    super(`${kind}: ${personMessage}`);
    this.name = 'VoiceError';
    this.kind = kind;
    this.personMessage = personMessage;
    if (cause !== undefined) this.cause = cause;
  }
}

const TYPE_INSTEAD = ' You can type instead — the conversation is the same either way.';

export const VOICE_MESSAGE: Record<VoiceFailureKind, string> = {
  unavailable: `Speaking out loud is not switched on in this build.${TYPE_INSTEAD}`,
  permissionDenied: `You Decide does not have permission to use the microphone. You can turn it on in Settings.${TYPE_INSTEAD}`,
  tooShort: 'That was too short to catch — hold the button while you speak, and let go when you are done.',
  noSpeech: `I could not hear anything in that.${TYPE_INSTEAD}`,
  transcribeFailed: `I could not make out what you said — that is a problem on our end, not yours.${TYPE_INSTEAD}`,
  speakFailed: 'I could not read that reply out loud, but it is on screen above.',
  recordFailed: `The microphone did not start.${TYPE_INSTEAD}`,
};

export function voiceError(kind: VoiceFailureKind, cause?: unknown): VoiceError {
  return new VoiceError(kind, VOICE_MESSAGE[kind], cause);
}

/** Below this, a recording is a mis-tap rather than a sentence. */
export const MIN_RECORDING_MS = 400;
