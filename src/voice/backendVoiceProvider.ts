import type { ApiClient } from '../api/client';
import { voiceError, type RecordedAudio, type SpeakableAudio, type VoiceProvider } from './types';

/**
 * Voice through our own backend, so provider keys never reach the phone.
 *
 * WHY NOT CALL THE PROVIDER DIRECTLY: `EXPO_PUBLIC_*` values are inlined into
 * the JavaScript bundle as plain strings. That is not a theory — the deployed
 * API base URL is visible in the bundle as
 * `value: "https://web-production-e36a6.up.railway.app"`. An
 * `EXPO_PUBLIC_ELEVENLABS_KEY` would sit there exactly the same way, readable
 * by anyone who pulls the bundle. A speech key is a billable credential; it
 * belongs on the server next to the Anthropic key.
 *
 * BACKEND CONTRACT this expects (not built yet — see the PR):
 *
 *   POST /v1/voice/transcribe   { audio_base64, mime_type }  -> { text }
 *   POST /v1/voice/speak        { text, voice_id? }          -> { audio_base64, mime_type }
 *
 * Base64 rather than multipart/binary on purpose: it goes through the same
 * JSON client as everything else, and `expo-file-system` reads and writes
 * base64 directly. The ~33% size overhead is worth the absence of a second
 * transport.
 */

type TranscribeResponse = { text?: string };
type SpeakResponse = { audio_base64?: string; audioBase64?: string; mime_type?: string; mimeType?: string };

export type FileBridge = {
  readAsBase64: (uri: string) => Promise<string>;
  writeBase64: (base64: string, mimeType: string) => Promise<string>;
  /** Bytes on disk. Used to catch a recording that captured nothing. */
  sizeOf?: (uri: string) => Promise<number>;
};

/** Voice calls carry audio and wait on a model. They need room. */
export const VOICE_TIMEOUT_MS = 60_000;

export class BackendVoiceProvider implements VoiceProvider {
  readonly name = 'backend';

  constructor(
    private readonly client: ApiClient,
    private readonly files: FileBridge,
    private readonly voiceId?: string,
  ) {}

  get isAvailable(): boolean {
    // No backend, no voice. The stub conversation is text-only by design: a
    // fake voice would be a worse lie than no voice.
    return this.client.isConnected;
  }

  async transcribe(audio: RecordedAudio): Promise<string> {
    const base64 = await this.files.readAsBase64(audio.uri);

    // Never POST an empty buffer. If the read produced nothing, the recording
    // is the problem, and saying so beats waiting for a transcription service
    // to return an empty string we would then misreport.
    if (base64.length === 0) {
      throw voiceError('silent');
    }

    const response = await this.client.request<TranscribeResponse>({
      method: 'POST',
      path: '/v1/voice/transcribe',
      body: { audio_base64: base64, mime_type: audio.mimeType },
      timeoutMs: VOICE_TIMEOUT_MS,
    });

    return (response.text ?? '').trim();
  }

  async synthesize(text: string): Promise<SpeakableAudio> {
    const response = await this.client.request<SpeakResponse>({
      method: 'POST',
      path: '/v1/voice/speak',
      body: this.voiceId !== undefined ? { text, voice_id: this.voiceId } : { text },
      timeoutMs: VOICE_TIMEOUT_MS,
    });

    const base64 = response.audio_base64 ?? response.audioBase64;
    if (base64 === undefined || base64.length === 0) {
      throw voiceError('speakFailed');
    }

    const mimeType = response.mime_type ?? response.mimeType ?? 'audio/mpeg';
    const uri = await this.files.writeBase64(base64, mimeType);
    return { uri, mimeType };
  }
}

/**
 * What we use when there is no backend: honest refusal.
 *
 * It reports `isAvailable: false` so the mic button can explain itself rather
 * than appearing to work and then failing on tap.
 */
export const unavailableVoiceProvider: VoiceProvider = {
  name: 'unavailable',
  isAvailable: false,
  async transcribe() {
    throw voiceError('unavailable');
  },
  async synthesize() {
    throw voiceError('unavailable');
  },
};
