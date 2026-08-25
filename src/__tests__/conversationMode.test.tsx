import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MIC_TEST_ID, VOICE_STAGE_TEST_ID } from '../components/MicButton';
import type { VoiceDependencies } from '../state/VoiceSession';
import type { MicSample } from '../voice/useMicrophone';
import type { VoiceProvider } from '../voice/types';
import { onTop, renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * Hands-free conversation.
 *
 * One tap in, one tap out, and no tapping between turns: it listens, notices
 * when you stop talking, sends, speaks, and listens again.
 *
 * These drive the recorder mock directly — pushing levels and elapsed time —
 * because that is the only honest way to test "it noticed they stopped".
 */

const SPEECH = -20;
const ROOM = -55;

/**
 * The listening loop reads the microphone on its OWN timer rather than on
 * React's render clock, so a test drives it by handing the session a `sample()`
 * it controls and letting a tick or two actually elapse.
 *
 * `sampleIntervalMs: 1` keeps that wait to a few real milliseconds.
 */
const reading: MicSample = { level: -160, durationMs: 0, isRecording: true };

/** Short timings so a test does not sit through a real 1.3s hangover. */
const FAST = { silenceHangoverMs: 300, minUtteranceMs: 100, meteringGraceMs: 300 };

function fakeVoice(overrides: Partial<VoiceProvider> = {}) {
  const provider: VoiceProvider = {
    name: 'fake',
    isAvailable: true,
    transcribe: jest.fn(async () => 'I am three months behind on my mortgage.'),
    synthesize: jest.fn(async () => ({ uri: 'file:///tmp/reply.mp3', mimeType: 'audio/mpeg' })),
    ...overrides,
  };

  const played: string[] = [];
  const stopRecording = jest.fn(async () => ({
    ok: true as const,
    audio: { uri: 'file:///tmp/recording.m4a', durationMs: 2500, mimeType: 'audio/m4a' },
  }));

  const dependencies: VoiceDependencies = {
    provider,
    startRecording: jest.fn(async () => undefined),
    stopRecording,
    measureBytes: jest.fn(async () => 48_000),
    play: jest.fn(async (uri: string) => {
      played.push(uri);
    }),
    log: () => undefined,
    endpointConfig: FAST,
    sample: () => ({ ...reading }),
    sampleIntervalMs: 1,
  };

  return { provider, played, dependencies, stopRecording };
}

/** Puts a level on the microphone and lets the loop actually read it. */
async function sample(level: number | null, elapsedMs: number) {
  reading.level = level;
  reading.durationMs = elapsedMs;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** Someone speaks, then stops. The trace that should end a turn. */
async function speakThenStop() {
  await sample(SPEECH, 200);
  await sample(SPEECH, 400);
  await sample(ROOM, 600);
  await sample(ROOM, 900);
}

beforeEach(() => {
  reading.level = -160;
  reading.durationMs = 0;
  reading.isRecording = true;
});

describe('entering and leaving', () => {
  it('starts a conversation with one tap', async () => {
    await renderApp({ voice: fakeVoice().dependencies });

    await fireEvent.press(onTop(MIC_TEST_ID));

    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/Listening — just talk/));
    expect(onTop(MIC_TEST_ID)).toHaveProp('accessibilityLabel', 'End the conversation');
  });

  it('tells the person it will keep listening, not to wait for a prompt', async () => {
    await renderApp({ voice: fakeVoice().dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    // "Listening…" alone leaves people waiting for a cue that never comes.
    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/just talk/));
  });

  it('leaves with one tap, and does not send what was half-said', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });

    await fireEvent.press(onTop(MIC_TEST_ID)); // in
    await sample(SPEECH, 200); // mid-sentence
    await fireEvent.press(onTop(MIC_TEST_ID)); // out

    await waitFor(() =>
      expect(onTop(MIC_TEST_ID)).toHaveProp('accessibilityLabel', 'Start talking'),
    );
    // Leaving is not submitting.
    expect(voice.provider.transcribe).not.toHaveBeenCalled();
  });
});

describe('a turn ends itself when the person stops talking', () => {
  it('sends without any tap', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();

    await waitFor(() => expect(voice.provider.transcribe).toHaveBeenCalled());
    expect(voice.stopRecording).toHaveBeenCalled();
  });

  it('puts the spoken words in the conversation and speaks the reply', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();

    await waitFor(() =>
      expect(screen.getByText('I am three months behind on my mortgage.')).toBeOnTheScreen(),
    );
    await waitFor(() => expect(voice.played.length).toBeGreaterThan(0));
  });

  it('starts listening again on its own afterwards', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();

    // The whole point: no tap between turns.
    await waitFor(() =>
      expect(voice.dependencies.startRecording as jest.Mock).toHaveBeenCalledTimes(2),
    );
  });

  it('does not cut in while it is still speaking', async () => {
    // Levels arriving during playback must not start a second turn — that is
    // how it would end up listening to itself.
    const voice = fakeVoice({
      synthesize: jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { uri: 'file:///tmp/reply.mp3', mimeType: 'audio/mpeg' };
      }),
    });
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();
    await sample(SPEECH, 1200); // noise arriving mid-reply
    await sample(SPEECH, 1400);

    await waitFor(() => expect(voice.played.length).toBeGreaterThan(0));
    // One turn sent, not two.
    expect((voice.provider.transcribe as jest.Mock).mock.calls.length).toBe(1);
  });
});

describe('a pause is not a failure', () => {
  it('keeps listening when a turn captured nothing, with no red warning', async () => {
    const voice = fakeVoice();
    voice.dependencies.stopRecording = jest.fn(async () => ({
      ok: false as const,
      kind: 'silent' as const,
    }));
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();

    // It went round again rather than telling someone off for thinking.
    await waitFor(() =>
      expect(voice.dependencies.startRecording as jest.Mock).toHaveBeenCalledTimes(2),
    );
    expect(onTop(VOICE_STAGE_TEST_ID)).not.toHaveTextContent(/came back empty/i);
  });

  it('says nothing when it could not make out words — that is a pause too', async () => {
    const voice = fakeVoice({ transcribe: jest.fn(async () => '') });
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();

    await waitFor(() =>
      expect(voice.dependencies.startRecording as jest.Mock).toHaveBeenCalledTimes(2),
    );
    expect(onTop(VOICE_STAGE_TEST_ID)).not.toHaveTextContent(/could not make out any words/i);
  });
});

/**
 * A REAL problem still has to survive the loop.
 *
 * Suppressing the pauses is only safe if the things that genuinely went wrong
 * still get said. Reopening the microphone a moment later must not wipe the
 * notice off the screen before anyone has read it.
 */
describe('a real failure is still reported, and stays reported', () => {
  it('keeps the message on screen while it goes back to listening', async () => {
    const voice = fakeVoice({
      synthesize: jest.fn(async () => {
        throw new Error('tts down');
      }),
    });
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await speakThenStop();

    // Said once...
    await waitFor(() =>
      expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/on screen above/i),
    );
    // ...and still there after the loop has reopened the mic for the next turn.
    await waitFor(() =>
      expect(voice.dependencies.startRecording as jest.Mock).toHaveBeenCalledTimes(2),
    );
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/on screen above/i);
  });
});

describe('when the phone reports no microphone levels', () => {
  /**
   * Without levels there is no way to know when someone finished. Rather than
   * leave a person talking at a mic that will never respond, it says so and the
   * same button reverts to tap-to-send.
   */
  it('falls back to tap-to-send and explains why', async () => {
    const voice = fakeVoice();
    // No levels from the very first sample — one real level is enough to prove
    // metering works, so the trace has to be null throughout.
    await sample(null, 0);
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await sample(null, 200);
    await sample(null, 400);

    await waitFor(() =>
      expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/not reporting microphone levels/i),
    );
    await waitFor(() => expect(onTop(MIC_TEST_ID)).toHaveProp('accessibilityLabel', 'Tap to speak'));
  });

  it('still sends the words already spoken rather than binning them', async () => {
    const voice = fakeVoice();
    await sample(null, 0);
    await renderApp({ voice: voice.dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    await sample(null, 200);
    await sample(null, 400);

    await waitFor(() => expect(voice.provider.transcribe).toHaveBeenCalled());
  });
});

describe('typing still works alongside it', () => {
  it('sends a typed message while voice is available', async () => {
    await renderApp({ voice: fakeVoice().dependencies });
    await sayToAi('I would rather type this one.');
    expect(screen.getByText('I would rather type this one.')).toBeOnTheScreen();
  });
});
