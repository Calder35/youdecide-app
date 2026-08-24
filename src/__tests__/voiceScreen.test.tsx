import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MIC_TEST_ID, VOICE_STAGE_TEST_ID } from '../components/MicButton';
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
  return {
    provider,
    played,
    dependencies: {
      provider,
      startRecording: jest.fn(async () => undefined),
      stopRecording: jest.fn(async () => ({
        uri: 'file:///tmp/recording.m4a',
        durationMs: 2500,
        mimeType: 'audio/m4a',
      })),
      play: jest.fn(async (uri: string) => {
        played.push(uri);
      }),
    },
  };
}

/** Hold the mic, speak, release. */
async function holdAndSpeak() {
  await fireEvent(onTop(MIC_TEST_ID), 'pressIn');
  await fireEvent(onTop(MIC_TEST_ID), 'pressOut');
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
    await fireEvent(onTop(MIC_TEST_ID), 'pressIn');
    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toBeOnTheScreen());
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/not switched on/i);
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/type instead/i);
  });
});

describe('speaking a turn', () => {
  it('puts the spoken words into the same conversation as typing', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });

    await holdAndSpeak();

    await waitFor(() =>
      expect(screen.getByText('I am not sure where to start with any of this.')).toBeOnTheScreen(),
    );
    // The AI answered in the same thread — the stub brain replies to it.
    await waitFor(() => expect(screen.getAllByTestId('turn-ai').length).toBeGreaterThan(1));
  });

  it('speaks the reply out loud', async () => {
    const voice = fakeVoice();
    await renderApp({ voice: voice.dependencies });

    await holdAndSpeak();

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

    await holdAndSpeak();

    // What they said still made it into the conversation.
    await waitFor(() =>
      expect(screen.getByText('I am not sure where to start with any of this.')).toBeOnTheScreen(),
    );
    expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/on screen above/i);
  });

  it('says it heard nothing when the transcript is empty', async () => {
    const voice = fakeVoice({ transcribe: jest.fn(async () => '') });
    await renderApp({ voice: voice.dependencies });

    await holdAndSpeak();

    await waitFor(() => expect(onTop(VOICE_STAGE_TEST_ID)).toHaveTextContent(/could not hear/i));
  });
});

describe('the mic explains itself', () => {
  it('names what holding it does', async () => {
    await renderApp({ voice: fakeVoice().dependencies });
    const mic = onTop(MIC_TEST_ID);
    expect(mic).toHaveProp('accessibilityLabel', 'Hold to speak');
    expect(mic.props.accessibilityHint).toMatch(/answer out loud/i);
  });

  it('tells a screen reader when voice is not available', async () => {
    await renderApp();
    expect(onTop(MIC_TEST_ID).props.accessibilityHint).toMatch(/not available/i);
  });
});
