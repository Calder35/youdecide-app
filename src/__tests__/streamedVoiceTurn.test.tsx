import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MIC_TEST_ID } from '../components/MicButton';
import { ApiClient } from '../api/client';
import type { VoiceDependencies } from '../state/VoiceSession';
import type { MicSample } from '../voice/useMicrophone';
import type { VoiceProvider } from '../voice/types';
import { onTop, renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * A spoken turn, streamed, through the whole app.
 *
 * These use the EXACT wire format the live endpoint sends — captured from it,
 * spacing and all — rather than a tidied-up version of the contract. The
 * difference between `{"type":"sentence"}` and `{"type": "sentence"}` is the
 * kind of thing that works in a test and fails on a phone.
 */

const LIVE_START = 'data: {"type": "start", "conversation_id": "2c398097-445f-435e-8aa6-15eca1c5c01b"}\n\n';
const LIVE_SENTENCE_0 =
  'data: {"type": "sentence", "seq": 0, "text": "Okay, that\'s workable, and it\'s more common than people think."}\n\n';
const LIVE_SENTENCE_1 =
  'data: {"type": "sentence", "seq": 1, "text": "Has anything formal come from your lender yet, like a notice of default?"}\n\n';
const LIVE_DONE =
  'data: {"type": "done", "conversation_id": "2c398097-445f-435e-8aa6-15eca1c5c01b", "reply": "Okay, that\'s workable, and it\'s more common than people think. Has anything formal come from your lender yet, like a notice of default?", "escalate": false, "escalate_kind": "none"}\n\n';

class FakeXHR {
  static latest: FakeXHR | null = null;

  readyState = 0;
  status = 0;
  responseText = '';
  onreadystatechange: (() => void) | null = null;
  opened: { method: string; url: string } | null = null;
  headers: Record<string, string> = {};
  body: string | undefined;

  constructor() {
    FakeXHR.latest = this;
  }
  open(method: string, url: string) {
    this.opened = { method, url };
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body?: string) {
    this.body = body;
  }
  abort() {}

  emit(text: string) {
    this.status = 200;
    this.responseText += text;
    this.readyState = 3;
    this.onreadystatechange?.();
  }
  complete(status = 200) {
    this.status = status;
    this.readyState = 4;
    this.onreadystatechange?.();
  }
}

const originalXHR = globalThis.XMLHttpRequest;

/**
 * `expo/fetch` is the preferred transport on a device, but it is a NATIVE
 * module and there is none under Jest. Forcing the XHR path here is not a
 * workaround — it is the fallback that ships for exactly that situation, so
 * this is the transport being exercised, not a stand-in for it.
 */
jest.mock('../api/streamFetch', () => ({
  expoFetchAvailable: () => false,
  streamFetch: () => {
    throw new Error('expo/fetch is not available under Jest');
  },
}));

beforeEach(() => {
  FakeXHR.latest = null;
  (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
});

afterEach(() => {
  (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXHR;
});

const reading: MicSample = { level: -160, durationMs: 0, isRecording: true };

function fakeVoice() {
  const provider: VoiceProvider = {
    name: 'fake',
    isAvailable: true,
    transcribe: jest.fn(async () => 'I am two months behind on my mortgage.'),
    synthesize: jest.fn(async (text: string) => ({
      uri: `file:///tmp/${encodeURIComponent(text.slice(0, 12))}.mp3`,
      mimeType: 'audio/mpeg',
    })),
  };

  const played: string[] = [];
  const dependencies: VoiceDependencies = {
    provider,
    startRecording: jest.fn(async () => undefined),
    stopRecording: jest.fn(async () => ({
      ok: true as const,
      audio: { uri: 'file:///tmp/recording.m4a', durationMs: 2500, mimeType: 'audio/m4a' },
    })),
    measureBytes: jest.fn(async () => 48_000),
    play: jest.fn(async (uri: string) => {
      played.push(uri);
    }),
    log: () => undefined,
    endpointConfig: { silenceHangoverMs: 300, minUtteranceMs: 100, meteringGraceMs: 300 },
    sample: () => ({ ...reading }),
    sampleIntervalMs: 1,
  };

  return { provider, played, dependencies };
}

function liveClient() {
  return new ApiClient({
    config: { mode: 'test-api', baseUrl: 'https://web-production-e36a6.up.railway.app' },
  });
}

async function sample(level: number | null, elapsedMs: number) {
  reading.level = level;
  reading.durationMs = elapsedMs;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** Enter conversation mode and finish one utterance. */
async function speakOneTurn() {
  await fireEvent.press(onTop(MIC_TEST_ID));
  await sample(-20, 200);
  await sample(-20, 400);
  await sample(-55, 600);
  await sample(-55, 900);
}

/**
 * A live stream, wrapped so the test drives React properly.
 *
 * `emit` lands sentences, which set state deep in the voice loop, so every push
 * has to happen inside `act()`. `finish` exists because a stream a test walks
 * away from keeps an armed idle timer and Jest will not exit.
 */
type Stream = { emit: (text: string) => Promise<void>; finish: (status?: number) => Promise<void>; raw: FakeXHR };

async function openedStream(): Promise<Stream> {
  await waitFor(() => expect(FakeXHR.latest).not.toBeNull());
  const raw = FakeXHR.latest as FakeXHR;
  return {
    raw,
    emit: async (text: string) => {
      await act(async () => {
        raw.emit(text);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    },
    finish: async (status = 200) => {
      await act(async () => {
        raw.complete(status);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    },
  };
}

/** Nothing may outlive a test holding a timer open. */
afterEach(async () => {
  const raw = FakeXHR.latest;
  if (raw !== null && raw.readyState !== 4) {
    await act(async () => {
      raw.complete(200);
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
});

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
};

beforeEach(() => {
  reading.level = -160;
  reading.durationMs = 0;
});

describe('a spoken turn goes to the streaming endpoint', () => {
  it('posts to /v1/chat/stream with mode "voice"', async () => {
    await renderApp({ client: liveClient(), voice: fakeVoice().dependencies });
    await speakOneTurn();

    const xhr = await openedStream();
    expect(xhr.raw.opened?.url).toMatch(/\/v1\/chat\/stream$/);
    expect(JSON.parse(xhr.raw.body ?? '{}')).toMatchObject({
      message: 'I am two months behind on my mortgage.',
      mode: 'voice',
    });
  });

  it('leaves typed messages on the plain endpoint', async () => {
    const bodies: unknown[] = [];
    const client = new ApiClient({
      config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
      fetchImpl: (async (_url: unknown, init?: { body?: string }) => {
        if (init?.body !== undefined) bodies.push(JSON.parse(init.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({ conversation_id: 'c-1', reply: 'Typed reply.', escalate: false }),
        } as Response;
      }) as unknown as typeof fetch,
    });

    await renderApp({ client, voice: fakeVoice().dependencies });
    await sayToAi('I would rather type this one.');

    // Went through fetch, not the stream — and carried no mode.
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(FakeXHR.latest).toBeNull();
    expect(Object.keys(bodies[0] as object)).not.toContain('mode');
  });
});

describe('it speaks sentence 0 while sentence 1 is still coming', () => {
  it('plays the first sentence before the stream has finished', async () => {
    const voice = fakeVoice();
    await renderApp({ client: liveClient(), voice: voice.dependencies });
    await speakOneTurn();

    const xhr = await openedStream();
    await xhr.emit(LIVE_START);
    await xhr.emit(LIVE_SENTENCE_0);
    await settle();

    // Spoken. The stream is still open and `done` has not been sent.
    expect(voice.played).toHaveLength(1);
    expect(voice.provider.synthesize).toHaveBeenCalledWith(
      "Okay, that's workable, and it's more common than people think.",
    );

    await xhr.emit(LIVE_SENTENCE_1);
    await xhr.emit(LIVE_DONE);
    await xhr.finish();
    await settle();

    expect(voice.played).toHaveLength(2);
  });

  it('puts the full reply from "done" in the transcript, exactly once', async () => {
    const voice = fakeVoice();
    await renderApp({ client: liveClient(), voice: voice.dependencies });
    await speakOneTurn();

    const xhr = await openedStream();
    await xhr.emit(LIVE_START + LIVE_SENTENCE_0 + LIVE_SENTENCE_1 + LIVE_DONE);
    await xhr.finish();

    await waitFor(() =>
      expect(
        screen.getByText(
          "Okay, that's workable, and it's more common than people think. Has anything formal come from your lender yet, like a notice of default?",
        ),
      ).toBeOnTheScreen(),
    );

    // Two sentences said aloud, one entry written down.
    expect(voice.played).toHaveLength(2);
  });

  it('listens again afterwards, with no tap', async () => {
    const voice = fakeVoice();
    await renderApp({ client: liveClient(), voice: voice.dependencies });
    await speakOneTurn();

    const xhr = await openedStream();
    await xhr.emit(LIVE_START + LIVE_SENTENCE_0 + LIVE_DONE);
    await xhr.finish();

    await waitFor(() =>
      expect(voice.dependencies.startRecording as jest.Mock).toHaveBeenCalledTimes(2),
    );
  });
});

describe('when the stream fails after it has started talking', () => {
  /**
   * The headers have already gone out, so the backend cannot send a 503 — it
   * sends an `error` event instead. Whatever was already spoken was spoken.
   */
  it('keeps what was said and stays in the conversation', async () => {
    const voice = fakeVoice();
    await renderApp({ client: liveClient(), voice: voice.dependencies });
    await speakOneTurn();

    const xhr = await openedStream();
    await xhr.emit(LIVE_START + LIVE_SENTENCE_0);
    await xhr.emit(
      'data: {"type": "error", "code": "upstream_unavailable", "message": "the model is unavailable"}\n\n',
    );
    await xhr.finish();

    // The sentence that was spoken is on screen...
    await waitFor(() =>
      expect(
        screen.getByText("Okay, that's workable, and it's more common than people think."),
      ).toBeOnTheScreen(),
    );
    // ...and the conversation keeps going rather than dying on it.
    await waitFor(() =>
      expect(voice.dependencies.startRecording as jest.Mock).toHaveBeenCalledTimes(2),
    );
  });
});
