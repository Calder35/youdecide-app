import { BackendVoiceProvider, unavailableVoiceProvider } from '../voice/backendVoiceProvider';
import { ApiClient } from '../api/client';
import {
  MIN_RECORDING_MS,
  VoiceError,
  voiceError,
  type RecordedAudio,
  type VoiceProvider,
} from '../voice/types';
import { runVoiceTurn, type VoiceTurnStage } from '../voice/voiceTurn';

const AUDIO: RecordedAudio = {
  uri: 'file:///tmp/recording.m4a',
  durationMs: 3200,
  mimeType: 'audio/m4a',
};

function harness(overrides: Partial<Parameters<typeof runVoiceTurn>[1]> = {}) {
  const stages: VoiceTurnStage[] = [];
  const errors: VoiceError[] = [];
  const spoken: string[] = [];
  const played: string[] = [];
  const sent: string[] = [];

  const provider: VoiceProvider = {
    name: 'fake',
    isAvailable: true,
    transcribe: jest.fn(async () => 'I inherited my mother’s house.'),
    synthesize: jest.fn(async (text: string) => {
      spoken.push(text);
      return { uri: 'file:///tmp/reply.mp3', mimeType: 'audio/mpeg' };
    }),
  };

  const deps = {
    provider,
    sendToBrain: jest.fn(async (transcript: string) => {
      sent.push(transcript);
      return 'That sounds like a lot to carry. Tell me more?';
    }),
    play: jest.fn(async (uri: string) => {
      played.push(uri);
    }),
    onStage: (stage: VoiceTurnStage) => stages.push(stage),
    onError: (error: VoiceError) => errors.push(error),
    ...overrides,
  };

  return { deps, stages, errors, spoken, played, sent, provider };
}

describe('a spoken turn, end to end', () => {
  it('goes speech → text → the brain → speech → played aloud', async () => {
    const h = harness();
    const transcript = await runVoiceTurn(AUDIO, h.deps);

    expect(transcript).toBe('I inherited my mother’s house.');
    expect(h.sent).toEqual(['I inherited my mother’s house.']);
    expect(h.spoken).toEqual(['That sounds like a lot to carry. Tell me more?']);
    expect(h.played).toEqual(['file:///tmp/reply.mp3']);
    expect(h.stages).toEqual(['transcribing', 'thinking', 'speaking', 'idle']);
    expect(h.errors).toEqual([]);
  });

  it('shows the transcript before the brain has answered', async () => {
    const seen: string[] = [];
    const h = harness({ onTranscript: (text: string) => seen.push(text) });
    await runVoiceTurn(AUDIO, h.deps);

    // The person sees their own words go up immediately, rather than watching
    // nothing happen while a model thinks.
    expect(seen).toEqual(['I inherited my mother’s house.']);
  });

  it('always returns to idle, whatever happened', async () => {
    const h = harness();
    await runVoiceTurn(AUDIO, h.deps);
    expect(h.stages[h.stages.length - 1]).toBe('idle');
  });
});

describe('when voice cannot work', () => {
  it('says so rather than pretending, when the provider is unavailable', async () => {
    const h = harness({ provider: unavailableVoiceProvider });
    const transcript = await runVoiceTurn(AUDIO, h.deps);

    expect(transcript).toBeNull();
    expect(h.errors[0].kind).toBe('unavailable');
    expect(h.sent).toEqual([]);
  });

  it('treats a mis-tap as a mis-tap, not as a failure', async () => {
    const h = harness();
    const transcript = await runVoiceTurn({ ...AUDIO, durationMs: MIN_RECORDING_MS - 1 }, h.deps);

    expect(transcript).toBeNull();
    expect(h.errors[0].kind).toBe('tooShort');
    expect(h.errors[0].personMessage).toMatch(/hold the button while you speak/i);
    expect(h.deps.provider.transcribe).not.toHaveBeenCalled();
  });

  it('says nothing was heard when the transcript comes back empty', async () => {
    const h = harness();
    (h.provider.transcribe as jest.Mock).mockResolvedValue('   ');
    await runVoiceTurn(AUDIO, h.deps);

    expect(h.errors[0].kind).toBe('noSpeech');
    expect(h.sent).toEqual([]);
  });

  it('reports a failed transcription without losing the person', async () => {
    const h = harness();
    (h.provider.transcribe as jest.Mock).mockRejectedValue(new Error('502'));
    await runVoiceTurn(AUDIO, h.deps);

    expect(h.errors[0].kind).toBe('transcribeFailed');
    expect(h.stages[h.stages.length - 1]).toBe('idle');
  });

  /**
   * The rule that matters most: once speech has become text, that text reaches
   * the brain even if speaking the answer aloud fails afterwards. Losing what
   * someone just said because a TTS call failed would be unforgivable.
   */
  it('keeps the person’s words when only the speaking fails', async () => {
    const h = harness();
    (h.provider.synthesize as jest.Mock).mockRejectedValue(new Error('tts down'));

    const transcript = await runVoiceTurn(AUDIO, h.deps);

    expect(transcript).toBe('I inherited my mother’s house.');
    expect(h.sent).toEqual(['I inherited my mother’s house.']); // reached the brain
    expect(h.errors[0].kind).toBe('speakFailed');
    expect(h.errors[0].personMessage).toMatch(/it is on screen above/i);
  });

  it('keeps the person’s words when playback fails', async () => {
    const h = harness({
      play: jest.fn(async () => {
        throw new Error('audio session busy');
      }),
    });
    const transcript = await runVoiceTurn(AUDIO, h.deps);

    expect(transcript).toBe('I inherited my mother’s house.');
    expect(h.errors[0].kind).toBe('speakFailed');
  });

  it('does not double-report when the brain itself fails', async () => {
    const h = harness({
      sendToBrain: jest.fn(async () => {
        throw new Error('backend down');
      }),
    });

    // The chat layer already shows its own error and offers a retry; voice
    // stays out of the way rather than stacking a second message on top.
    await expect(runVoiceTurn(AUDIO, h.deps)).rejects.toThrow('backend down');
    expect(h.errors).toEqual([]);
    expect(h.stages[h.stages.length - 1]).toBe('idle');
  });

  it('stays quiet when the brain returns nothing to say', async () => {
    const h = harness({ sendToBrain: jest.fn(async () => null) });
    const transcript = await runVoiceTurn(AUDIO, h.deps);

    expect(transcript).toBe('I inherited my mother’s house.');
    expect(h.spoken).toEqual([]);
    expect(h.errors).toEqual([]);
  });
});

describe('every voice failure leaves typing available', () => {
  it('says so in the message itself', () => {
    for (const kind of ['unavailable', 'permissionDenied', 'noSpeech', 'transcribeFailed', 'recordFailed'] as const) {
      expect(`${kind}: ${voiceError(kind).personMessage}`).toMatch(/type instead/i);
    }
  });
});

describe('the backend-proxied provider', () => {
  function providerWith(handler: (path: string, body: unknown) => unknown) {
    const seen: { path: string; body: unknown; timeoutMs?: number }[] = [];
    const client = new ApiClient({
      config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
      fetchImpl: (async (input: unknown, init?: { body?: string }) => {
        const path = String(input).replace(/^https?:\/\/[^/]+/, '');
        const body = init?.body !== undefined ? JSON.parse(init.body) : undefined;
        seen.push({ path, body });
        return { ok: true, status: 200, json: async () => handler(path, body) } as Response;
      }) as unknown as typeof fetch,
    });
    const files = {
      readAsBase64: jest.fn(async () => 'BASE64AUDIO'),
      writeBase64: jest.fn(async () => 'file:///tmp/voice/reply.mp3'),
    };
    return { provider: new BackendVoiceProvider(client, files), seen, files };
  }

  it('uploads the recording to our own backend, never to a vendor', async () => {
    const { provider, seen, files } = providerWith(() => ({ text: 'hello there' }));
    const text = await provider.transcribe(AUDIO);

    expect(text).toBe('hello there');
    expect(seen[0].path).toBe('/v1/voice/transcribe');
    expect(seen[0].body).toEqual({ audio_base64: 'BASE64AUDIO', mime_type: 'audio/m4a' });
    expect(files.readAsBase64).toHaveBeenCalledWith(AUDIO.uri);
  });

  it('asks our own backend to speak, and writes the audio to a file', async () => {
    const { provider, seen, files } = providerWith(() => ({
      audio_base64: 'SPEECHBYTES',
      mime_type: 'audio/mpeg',
    }));

    const speech = await provider.synthesize('You are not on your own with this.');
    expect(seen[0].path).toBe('/v1/voice/speak');
    expect(seen[0].body).toEqual({ text: 'You are not on your own with this.' });
    expect(files.writeBase64).toHaveBeenCalledWith('SPEECHBYTES', 'audio/mpeg');
    expect(speech.uri).toBe('file:///tmp/voice/reply.mp3');
  });

  it('fails clearly when the backend returns no audio', async () => {
    const { provider } = providerWith(() => ({ audio_base64: '' }));
    await expect(provider.synthesize('hello')).rejects.toMatchObject({ kind: 'speakFailed' });
  });

  it('is unavailable when there is no backend, rather than half-working', () => {
    const offline = new BackendVoiceProvider(
      new ApiClient({ config: { mode: 'offline', baseUrl: '' } }),
      { readAsBase64: jest.fn(), writeBase64: jest.fn() },
    );
    expect(offline.isAvailable).toBe(false);
  });
});
