import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  LEVEL_METER_TEST_ID,
  MIC_TEST_ID,
  VOICE_STAGE_TEST_ID,
  formatElapsed,
  normalizeLevel,
} from '../components/MicButton';
import type { VoiceDependencies } from '../state/VoiceSession';
import type { VoiceProvider } from '../voice/types';
import { onTop, renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * Voice on the conversation screen.
 *
 * The thing these hold: voice is ADDITIVE. The mic sits beside the composer,
 * and everything that worked by typing still works — including when voice is
 * unavailable or broken.
 */

function fakeVoice(overrides: Partial<VoiceProvider> = {}) {
  const provider: VoiceProvider = {
    name: 'fake',
    isAvailable: true,
    transcribe: jest.fn(async () => 'I am not sure where to start with any of this.'),
    synthesize: jest.fn(async () => ({ uri: 'file:///tmp/reply.mp3', mimeType: 'audio/mpeg' })),
    ...overrides,
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
  };

  return { provider, played, dependencies };
}

/** Tap to start, speak, tap to stop — the interaction a person performs. */
async function tapSpeakTap() {
  await fireEvent.press(onTop(MIC_TEST_ID)); // start
  await fireEvent.press(onTop(MIC_TEST_ID)); // stop
}

describe('the mic sits beside typing, not instead of it', () => {
  it('shows both the mic and the text composer', async () => {
    await renderApp({ voice: fakeVoice().dependencies });
    expect(onTop(MIC_TEST_ID)).toBeOnTheScreen();
    expect(onTop('chat-input')).toBeOnTheScreen();
    expect(onTop('chat-send')).toBeOnTheScreen();
  });

  it('still lets a person type when voice is unavailable', async () => {
    await renderApp(); // no voice dependencies → provider unavailable
    await sayToAi('I would rather type.');
    expect(screen.getByText('I would rather type.')).toBeOnTheScreen();
  });

  it('explains itself rather than failing silently when voice is off', async () => {
    await renderApp();
    await fireEvent.press(onTop(MIC_TEST_ID));
    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toBeOnTheScreen());
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/not switched on/i);
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/type instead/i);
  });
});

describe('speaking a turn', () => {
  it('puts the spoken words into the same conversation as typing', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });

    await tapSpeakTap();

    await waitFor(() =>
      expect(screen.getByText('I am not sure where to start with any of this.')).toBeOnTheScreen(),
    );
    // The AI answered in the same thread — the stub brain replies to it.
    await waitFor(() => expect(screen.getAllByTestId('turn-ai').length).toBeGreaterThan(1));
  });

  it('speaks the reply out loud', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });

    await tapSpeakTap();

    await waitFor(() => expect(voice.provider.synthesize).toHaveBeenCalled());
    expect(voice.played).toEqual(['file:///tmp/reply.mp3']);
  });

  it('keeps the words on screen even when speaking them fails', async () => {
    const voice = fakeVoice({
      synthesize: jest.fn(async () => {
        throw new Error('tts down');
      }),
    });
    await renderApp({ voice: voice.dependencies });

    await tapSpeakTap();

    // What they said still made it into the conversation.
    await waitFor(() =>
      expect(screen.getByText('I am not sure where to start with any of this.')).toBeOnTheScreen(),
    );
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/on screen above/i);
  });

  it('says it heard nothing when the transcript is empty', async () => {
    const voice = fakeVoice({ transcribe: jest.fn(async () => '') });
    await renderApp({ voice: voice.dependencies });

    await tapSpeakTap();

    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/could not make out any words/i));
  });
});

describe('the mic explains itself', () => {
  it('names what holding it does', async () => {
    await renderApp({ voice: fakeVoice().dependencies });
    const mic = onTop(MIC_TEST_ID);
    expect(mic).toHaveProp('accessibilityLabel', 'Tap to speak');
    expect(mic.props.accessibilityHint).toMatch(/tap once to start/i);
  });

  it('tells a screen reader when voice is not available', async () => {
    await renderApp();
    expect(onTop(MIC_TEST_ID).props.accessibilityHint).toMatch(/not available/i);
  });
});

/**
 * The interaction itself — the thing that was actually broken.
 */
describe('tap to start, tap to stop', () => {
  it('shows a visible listening state after one tap', async () => {
    await renderApp({ voice: fakeVoice().dependencies });

    await fireEvent.press(onTop(MIC_TEST_ID));

    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/Listening/i));
    // The button itself changes to a stop, so the way out is unmistakable.
    expect(onTop(MIC_TEST_ID)).toHaveProp('accessibilityLabel', 'Stop recording and send');
  });

  it('shows a live level meter while listening, so silence is visible', async () => {
    await renderApp({ voice: fakeVoice().dependencies });
    await fireEvent.press(onTop(MIC_TEST_ID));

    // The meter is decorative and hidden from screen readers on purpose — the
    // stage line announces "Listening, N seconds" instead — so the query has to
    // opt into hidden elements.
    await waitFor(() =>
      expect(
        screen.getAllByTestId(LEVEL_METER_TEST_ID, { includeHiddenElements: true }).length,
      ).toBeGreaterThan(0),
    );
    expect(onTop('voice-timer')).toBeOnTheScreen();
  });

  it('does not send anything on the first tap alone', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });

    await fireEvent.press(onTop(MIC_TEST_ID));

    // The old press-and-hold sent on release. One tap now only starts.
    expect(voice.provider.transcribe).not.toHaveBeenCalled();
  });

  it('says the recording never started, rather than blaming the person’s voice', async () => {
    const voice = fakeVoice();
    voice.dependencies.stopRecording = jest.fn(async () => ({
      ok: false as const,
      kind: 'didNotStart' as const,
    }));
    await renderApp({ voice: voice.dependencies });

    await fireEvent.press(onTop(MIC_TEST_ID));
    await fireEvent.press(onTop(MIC_TEST_ID));

    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/had not started/i));
    expect(onTop(VOICE_STAGE_TEST_ID)).not.toHaveTextContent(/could not make out any words/i);
  });

  it('says the capture was empty when the mic produced no audio', async () => {
    const voice = fakeVoice();
    voice.dependencies.measureBytes = jest.fn(async () => 300);
    await renderApp({ voice: voice.dependencies });

    await tapSpeakTap();

    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/came back empty/i));
    expect(voice.provider.transcribe).not.toHaveBeenCalled();
  });
});

describe('the timer never shows nonsense', () => {
  it('reads 0:00 before the recorder reports a duration', () => {
    expect(formatElapsed(Number.NaN)).toBe('0:00');
    expect(formatElapsed(undefined as unknown as number)).toBe('0:00');
    expect(formatElapsed(-5)).toBe('0:00');
  });

  it('counts in minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_400)).toBe('0:07');
    expect(formatElapsed(65_000)).toBe('1:05');
  });

  it('shows an empty meter for silence and a full one for a loud voice', () => {
    expect(normalizeLevel(-160)).toBe(0); // silence
    expect(normalizeLevel(null)).toBe(0);
    expect(normalizeLevel(0)).toBe(1); // as loud as it gets
    expect(normalizeLevel(-25)).toBeCloseTo(0.5, 1);
  });
});
