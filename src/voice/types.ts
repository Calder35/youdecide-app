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
  /** Milliseconds, from the recorder itself rather than wall-clock. */
  durationMs: number;
  /** e.g. 'audio/m4a' — derived from what the recorder actually wrote. */
  mimeType: string;
  /** File size. Zero means the mic produced nothing, whatever the duration says. */
  bytes?: number;
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
  /** Declined this time, but we may ask again. */
  | 'permissionDenied'
  /** Turned off at the OS level. Only Settings can fix it. */
  | 'permissionBlocked'
  /** Stop arrived before recording had actually begun. */
  | 'didNotStart'
  | 'tooShort'
  /** The file exists but holds no audio. */
  | 'silent'
  | 'noSpeech'
  | 'transcribeFailed'
  | 'speakFailed'
  /** Some of the reply was spoken, then it stopped. */
  | 'speakCutShort'
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

/**
 * Each of these says something DIFFERENT, on purpose.
 *
 * The bug that prompted this file's last edit: a permission problem and a
 * recording that never started were both reported as "I could not hear anything
 * in that." Someone whose microphone is switched off at the OS level was being
 * told the AI could not hear them — so they said it again, louder, and it
 * failed again. A wrong diagnosis is worse than no diagnosis.
 */
export const VOICE_MESSAGE: Record<VoiceFailureKind, string> = {
  unavailable: `Speaking out loud is not switched on in this build.${TYPE_INSTEAD}`,
  permissionDenied:
    `You Decide needs permission to use the microphone. Tap the mic again and choose "Allow".${TYPE_INSTEAD}`,
  permissionBlocked:
    `Microphone access is off for this app. Open Settings › Expo Go › Microphone and switch it on, then come back.${TYPE_INSTEAD}`,
  didNotStart: 'Recording had not started yet — tap the mic, wait for “Listening”, then speak.',
  tooShort: 'That was only a moment — tap the mic, speak, then tap again when you are done.',
  silent: `The recording came back empty, so the microphone may not be picking anything up.${TYPE_INSTEAD}`,
  noSpeech: `I could not make out any words in that.${TYPE_INSTEAD}`,
  transcribeFailed: `I could not make out what you said — that is a problem on our end, not yours.${TYPE_INSTEAD}`,
  speakFailed: 'I could not read that reply out loud, but it is on screen above.',
  speakCutShort: 'I got partway through reading that out — the rest is on screen above.',
  recordFailed: `The microphone did not start.${TYPE_INSTEAD}`,
};

export function voiceError(kind: VoiceFailureKind, cause?: unknown): VoiceError {
  return new VoiceError(kind, VOICE_MESSAGE[kind], cause);
}

/** Below this, a recording is a mis-tap rather than a sentence. */
export const MIN_RECORDING_MS = 400;

/**
 * Below this, the file is a container header with no audio in it.
 *
 * An empty m4a still weighs a few hundred bytes, so "the file exists" proves
 * nothing. Checking the size is what catches a mic that opened but captured
 * silence — the failure that sent us here.
 */
export const MIN_AUDIO_BYTES = 2_000;
