import { screen, waitFor } from '@testing-library/react-native';

import { ESCALATION_TEST_ID } from '../components/EscalationOffer';
import { TYPING_TEST_ID } from '../components/TypingIndicator';
import { CHAT_SCREEN_TEST_ID } from '../screens/ChatScreen';
import { onTop, pressOnTop, renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * The opening experience.
 *
 * These are the tests that hold the shape of the product decision: a person
 * arrives in a conversation, the AI leads with discovery, and nothing about
 * the fee, the listing process, or a standing route past the AI to a human
 * appears in front of them.
 */

describe('the opening screen is the conversation', () => {
  it('is the chat, on launch, with no navigation needed', async () => {
    await renderApp();
    expect(onTop(CHAT_SCREEN_TEST_ID)).toBeOnTheScreen();
  });

  it('opens with the AI speaking first, and asking about the person', async () => {
    await renderApp();
    const opener = screen.getByText(/What's on your mind\?/);
    expect(opener).toBeOnTheScreen();
    // It asks about them before it asks about property.
    expect(opener).toHaveTextContent(/before we talk about anything to do with property/i);
  });

  it('invites a sentence rather than a form field', async () => {
    await renderApp();
    expect(onTop('chat-input')).toBeOnTheScreen();
    expect(onTop('chat-input')).toHaveProp('placeholder', 'Say as much or as little as you like…');
  });
});

describe('the opening carries no fee or process framing', () => {
  /** Everything that used to be the front door and must not be, now. */
  const FORBIDDEN = [
    /1%/,
    /listing fee/i,
    /list your home/i,
    /sell your (nevada )?home/i,
    /buyer'?s agent/i,
    /commission/i,
    /step \d+ of \d+/i,
    /property workspace/i,
    /seller/i,
  ];

  it('shows none of it on the opening screen', async () => {
    await renderApp();
    for (const pattern of FORBIDDEN) {
      expect(`${pattern} -> ${screen.queryAllByText(pattern).length}`).toBe(`${pattern} -> 0`);
    }
  });

  it('still shows none of it after a few turns of conversation', async () => {
    await renderApp();
    await sayToAi('I inherited my mother’s house and I do not know where to start.');
    await sayToAi('It has been in the family a long time.');

    for (const pattern of FORBIDDEN) {
      expect(`${pattern} -> ${screen.queryAllByText(pattern).length}`).toBe(`${pattern} -> 0`);
    }
  });
});

describe('there is no standing route past the AI to a human', () => {
  it('shows no "get a human" control on the opening screen', async () => {
    await renderApp();
    expect(screen.queryByText(/get a human/i)).toBeNull();
    expect(screen.queryByLabelText(/get a human/i)).toBeNull();
    expect(screen.queryByText(/talk to a (human|person)/i)).toBeNull();
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
  });

  it('shows no escalation offer during an ordinary discovery conversation', async () => {
    await renderApp();
    await sayToAi('I am thinking about moving closer to my daughter next year.');
    await sayToAi('She just had a baby and I would like to be nearby.');
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
  });
});

describe('the AI leads with discovery', () => {
  it('reflects back what the person actually said', async () => {
    await renderApp();
    await sayToAi('I am getting divorced and the house has to be dealt with');
    // Their own words come back to them, quoted, in the AI's reply — not just
    // echoed in their own bubble.
    const aiTurns = screen.getAllByTestId('turn-ai');
    const latest = aiTurns[aiTurns.length - 1];
    expect(latest).toHaveTextContent(/getting divorced/);
  });

  it('shows the person their own message in the conversation', async () => {
    await renderApp();
    await sayToAi('Just looking for now.');
    expect(screen.getByText('Just looking for now.')).toBeOnTheScreen();
    expect(onTop('turn-you')).toBeOnTheScreen();
  });

  it('asks a follow-up question rather than proposing anything', async () => {
    await renderApp();
    await sayToAi('My job is relocating me to Reno in the spring.');
    const aiTurns = screen.getAllByTestId('turn-ai');
    const latest = aiTurns[aiTurns.length - 1];
    expect(latest).toHaveTextContent(/\?/);
  });

  it('does not let a person stack messages while the AI is composing', async () => {
    await renderApp({});
    // With no typing delay in tests the indicator is not observable; the send
    // control is still the thing that gates it.
    expect(screen.queryByTestId(TYPING_TEST_ID)).toBeNull();
    expect(onTop('chat-send')).toBeOnTheScreen();
  });
});

describe('a person arrives only when the AI decides one is needed', () => {
  it('offers support when someone describes a hard circumstance', async () => {
    await renderApp();
    await sayToAi('We are facing foreclosure and I am scared.');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.getByText(/There is someone here when you want them/)).toBeOnTheScreen();
  });

  it('hands a licensed question to a licensed person', async () => {
    await renderApp();
    await sayToAi('Can you tell me what the contract legally requires me to disclose?');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.getByText(/needs a licensed agent/i)).toBeOnTheScreen();
  });

  it('responds to distress with care, and does not talk about property', async () => {
    await renderApp();
    await sayToAi('Honestly I do not want to live anymore.');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());

    expect(screen.getByText(/Let's get a person with you/)).toBeOnTheScreen();
    expect(screen.getByText(/immediate danger/i)).toBeOnTheScreen();
    // Nothing transactional appears next to someone in crisis.
    expect(screen.queryByText(/1%/)).toBeNull();
    expect(screen.queryByText(/listing/i)).toBeNull();
  });

  it('leads to the handoff, which still says what would be shared', async () => {
    await renderApp();
    await sayToAi('I lost my job and cannot afford the payments.');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    await pressOnTop('escalation-accept');
    expect(screen.getByText('What transfers with this request')).toBeOnTheScreen();
  });
});
