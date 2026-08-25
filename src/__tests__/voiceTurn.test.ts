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
import { mimeTypeFor } from '../voice/useMicrophone';
import { expoFileBridge } from '../voice/expoFileBridge';

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
    expect(h.errors[0].personMessage).toMatch(/tap the mic, speak, then tap again/i);
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

/**
 * Regression guards for the bug that made voice look broken on a real phone.
 *
 * Symptom: tapping the mic immediately showed "I could not hear anything in
 * that." Cause: the mic was press-and-hold, `onPressIn` began an async start
 * (permission → audio mode → prepare) and `onPressOut` stopped it. A tap
 * stopped a recording that had never begun — and on the first tap of all, the
 * permission dialog cancelled the touch, so it could never work.
 *
 * Nothing was wrong with the microphone. The app blamed the person's voice.
 */
describe('a capture that never happened is not silence', () => {
  it('tells "recording had not started" apart from "I heard no words"', () => {
    const didNotStart = voiceError('didNotStart').personMessage;
    const noSpeech = voiceError('noSpeech').personMessage;

    expect(didNotStart).not.toBe(noSpeech);
    expect(didNotStart).toMatch(/had not started/i);
    // It tells the person the interaction, because the interaction is the fix.
    expect(didNotStart).toMatch(/tap the mic/i);
  });

  it('tells a blocked microphone apart from a declined one', () => {
    const blocked = voiceError('permissionBlocked').personMessage;
    const denied = voiceError('permissionDenied').personMessage;

    expect(blocked).not.toBe(denied);
    // Blocked can only be fixed in Settings; saying "tap again" would send
    // someone at a button that can never work.
    expect(blocked).toMatch(/settings/i);
    expect(denied).toMatch(/tap the mic again/i);
  });

  it('never reports a permission problem as the AI failing to hear', () => {
    for (const kind of ['permissionDenied', 'permissionBlocked', 'didNotStart'] as const) {
      expect(`${kind}: ${voiceError(kind).personMessage}`).not.toMatch(/could not make out any words/i);
    }
  });
});

describe('verifying the capture before spending a request on it', () => {
  const MEASURED: RecordedAudio = { ...AUDIO, mimeType: 'audio/m4a' };

  it('refuses to upload a file with no audio in it', async () => {
    const h = harness({ measureBytes: async () => 384 }); // an empty m4a header
    const transcript = await runVoiceTurn(MEASURED, h.deps);

    expect(transcript).toBeNull();
    expect(h.errors[0].kind).toBe('silent');
    expect(h.deps.provider.transcribe).not.toHaveBeenCalled();
  });

  it('uploads a recording that actually holds audio', async () => {
    const h = harness({ measureBytes: async () => 48_000 });
    await runVoiceTurn(MEASURED, h.deps);
    expect(h.deps.provider.transcribe).toHaveBeenCalled();
  });

  it('logs what the microphone actually produced', async () => {
    const lines: string[] = [];
    const h = harness({ measureBytes: async () => 48_000, log: (line: string) => lines.push(line) });
    await runVoiceTurn(MEASURED, h.deps);

    // Duration, size and format — the three things we could not see when this
    // was failing on a device.
    expect(lines.join('\n')).toMatch(/3200ms/);
    expect(lines.join('\n')).toMatch(/48000 bytes/);
    expect(lines.join('\n')).toMatch(/audio\/m4a/);
  });
});

describe('the mime type comes from the file, not from an assumption', () => {
  it('maps what expo-audio actually writes', () => {
    expect(mimeTypeFor('file:///tmp/rec.m4a')).toBe('audio/m4a');
    expect(mimeTypeFor('file:///tmp/rec.wav')).toBe('audio/wav');
    expect(mimeTypeFor('file:///tmp/rec.webm')).toBe('audio/webm');
  });

  it('falls back to m4a, which is what the backend assumes too', () => {
    expect(mimeTypeFor('file:///tmp/recording')).toBe('audio/m4a');
    expect(mimeTypeFor('file:///tmp/rec.weird')).toBe('audio/m4a');
  });
});

describe('the whole turn is logged, not just the capture', () => {
  it('records what happened at each step of a good turn', async () => {
    const lines: string[] = [];
    const h = harness({ measureBytes: async () => 48_000, log: (line: string) => lines.push(line) });
    await runVoiceTurn(AUDIO, h.deps);

    const transcript = lines.join('\n');
    expect(transcript).toMatch(/captured/);
    expect(transcript).toMatch(/transcript \d+ chars/);
    expect(transcript).toMatch(/speaking \d+ chars/);
    expect(transcript).toMatch(/turn complete/);
  });

  it('says why transcription failed, rather than leaving us to infer it', async () => {
    const lines: string[] = [];
    const h = harness({ log: (line: string) => lines.push(line) });
    (h.provider.transcribe as jest.Mock).mockRejectedValue(new Error('503 from provider'));
    await runVoiceTurn(AUDIO, h.deps);

    expect(lines.join('\n')).toMatch(/transcribe failed/);
  });

  it('distinguishes "heard no words" from "the request failed"', async () => {
    const lines: string[] = [];
    const h = harness({ log: (line: string) => lines.push(line) });
    (h.provider.transcribe as jest.Mock).mockResolvedValue('');
    await runVoiceTurn(AUDIO, h.deps);

    // The recording had audio and the service still returned nothing — that
    // points at the microphone, not the network, and the log should say so.
    expect(lines.join('\n')).toMatch(/empty despite a non-empty recording/);
  });
});

describe('speaking is reliable, or says why it was not', () => {
  it('speaks on an ordinary turn', async () => {
    const h = harness({ measureBytes: async () => 48_000 });
    await runVoiceTurn(AUDIO, h.deps);
    expect(h.spoken).toHaveLength(1);
    expect(h.played).toHaveLength(1);
  });

  /**
   * Escalation must not suppress the voice. The reply is spoken whatever the
   * AI decided about bringing a person in — including a crisis reply, which is
   * the one someone is least able to read calmly off a screen.
   */
  it('still speaks when the turn escalates', async () => {
    for (const reply of [
      'That sounds really hard. There is someone here who can help.',
      'I want to stop and say something, because it matters more than the rest.',
    ]) {
      const h = harness({
        measureBytes: async () => 48_000,
        sendToBrain: jest.fn(async () => reply),
      });
      await runVoiceTurn(AUDIO, h.deps);
      expect(h.spoken).toEqual([reply]);
    }
  });

  it('retries once before giving up on speaking', async () => {
    const h = harness({
      measureBytes: async () => 48_000,
      // A short reply, so this is one chunk and the retry count is unambiguous.
      sendToBrain: jest.fn(async () => 'Tell me more.'),
    });
    (h.provider.synthesize as jest.Mock)
      .mockRejectedValueOnce(new Error('transient 503'))
      .mockResolvedValueOnce({ uri: 'file:///tmp/reply.mp3', mimeType: 'audio/mpeg' });

    await runVoiceTurn(AUDIO, h.deps);

    // A single blip between the phone and the speech service should not turn a
    // warm reply into a wall of text.
    expect(h.provider.synthesize).toHaveBeenCalledTimes(2);
    expect(h.played).toEqual(['file:///tmp/reply.mp3']);
    expect(h.errors).toEqual([]);
  });

  it('logs the retry, and the reason, when speaking finally fails', async () => {
    const lines: string[] = [];
    const h = harness({ measureBytes: async () => 48_000, log: (line: string) => lines.push(line) });
    (h.provider.synthesize as jest.Mock).mockRejectedValue(new Error('tts really down'));

    await runVoiceTurn(AUDIO, h.deps);

    expect(h.provider.synthesize).toHaveBeenCalledTimes(2);
    expect(lines.join('\n')).toMatch(/retrying once/);
    expect(lines.join('\n')).toMatch(/speak failed on chunk 1\/1 after 0 spoken — .*tts really down/);
    expect(h.errors[0].kind).toBe('speakFailed');
  });
});

/**
 * The file bridge is where spoken replies land, and it is where they were being
 * lost. The modern synchronous `File.write()` threw on device for every reply:
 *
 *   FunctionCallException: Calling the 'write' function has failed
 *
 * These pin the shape of the fix so a future tidy-up does not walk back into it.
 */
describe('writing spoken audio to disk', () => {
  it('uses the ASYNC writer, not the synchronous one', async () => {
    const legacy = jest.requireMock('expo-file-system/legacy') as {
      writeAsStringAsync: jest.Mock;
      makeDirectoryAsync: jest.Mock;
    };
    legacy.writeAsStringAsync.mockClear();

    const uri = await expoFileBridge.writeBase64('QUJD', 'audio/mpeg');

    expect(legacy.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [writtenTo, contents, options] = legacy.writeAsStringAsync.mock.calls[0];
    expect(contents).toBe('QUJD');
    expect(options).toEqual({ encoding: 'base64' });
    // Named by content type, in the cache — spoken replies are disposable.
    expect(String(writtenTo)).toMatch(/\.mp3$/);
    expect(String(writtenTo)).toContain('voice');
    expect(uri).toBe(writtenTo);
  });

  it('names the file for what the audio actually is', async () => {
    const legacy = jest.requireMock('expo-file-system/legacy') as { writeAsStringAsync: jest.Mock };

    for (const [mime, extension] of [
      ['audio/mpeg', 'mp3'],
      ['audio/m4a', 'm4a'],
      ['audio/wav', 'wav'],
      ['application/octet-stream', 'bin'],
    ] as const) {
      legacy.writeAsStringAsync.mockClear();
      await expoFileBridge.writeBase64('QUJD', mime);
      expect(`${mime}: ${legacy.writeAsStringAsync.mock.calls[0][0]}`).toMatch(
        new RegExp(`\\.${extension}$`),
      );
    }
  });
});

/**
 * Where the seconds went.
 *
 * "It's still slow" is not a thing anyone can act on. A per-turn breakdown is:
 * it says whether to go and argue with the speech service, the model, or the
 * synthesiser. `toFirstSoundMs` is the number a person actually feels — the
 * silence between them finishing their sentence and hearing anything back.
 */
describe('every turn reports where its time went', () => {
  /** A clock that advances a fixed amount on each read, so timings are exact. */
  function clock(steps: number[]) {
    let index = 0;
    let elapsed = 0;
    return () => {
      elapsed += steps[Math.min(index, steps.length - 1)] ?? 0;
      index += 1;
      return elapsed;
    };
  }

  it('breaks the wait down into speech, brain, and synthesis', async () => {
    const timings: Parameters<NonNullable<Parameters<typeof runVoiceTurn>[1]['onTiming']>>[0][] =
      [];
    const h = harness({ now: clock([0, 100]), onTiming: (t) => timings.push(t) });

    await runVoiceTurn(AUDIO, h.deps);

    expect(timings).toHaveLength(1);
    const [timing] = timings;
    // Each stage was measured separately rather than lumped together...
    expect(timing.sttMs).toBeGreaterThan(0);
    expect(timing.chatMs).toBeGreaterThan(0);
    expect(timing.ttsFirstChunkMs).toBeGreaterThan(0);
    // ...and the felt delay is at least the sum of the three that cause it.
    expect(timing.toFirstSoundMs).toBeGreaterThanOrEqual(
      timing.sttMs + timing.chatMs + timing.ttsFirstChunkMs,
    );
  });

  it('reports at the FIRST sound, not at the end of the reply', async () => {
    // A long reply is spoken in several pieces. The wait people care about
    // ended when the first one started playing; everything after that is the
    // reply happening, which is not waiting.
    const timings: { toFirstSoundMs: number; chunkCount: number }[] = [];
    const h = harness({
      sendToBrain: jest.fn(async () => LONG_SPOKEN_REPLY),
      onTiming: (t) => timings.push(t),
    });

    await runVoiceTurn(AUDIO, h.deps);

    expect(timings).toHaveLength(1);
    expect(timings[0].chunkCount).toBeGreaterThan(1);
    // Reported before the later chunks had even been spoken.
    expect(h.played.length).toBeGreaterThan(1);
  });

  it('says nothing about timing when there was no reply to speak', async () => {
    const timings: unknown[] = [];
    const h = harness({ sendToBrain: jest.fn(async () => null), onTiming: () => timings.push(1) });

    await runVoiceTurn(AUDIO, h.deps);

    expect(timings).toEqual([]);
  });
});

const LONG_SPOKEN_REPLY =
  'That happens a lot, and there are real options — selling on your terms is one of them. ' +
  'Has anything formal come from your lender yet, like a notice of default? ' +
  'Knowing that changes the timeline, and it changes which doors are still open to you. ' +
  'Either way, we can work out what the house would realistically bring in today.';
