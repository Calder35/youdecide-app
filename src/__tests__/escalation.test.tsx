import { screen, waitFor } from '@testing-library/react-native';

import { ApiClient } from '../api/client';
import { CRISIS_RESOURCE_TEST_ID, ESCALATION_TEST_ID } from '../components/EscalationOffer';
import { onTop, renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * What the handoff card is allowed to say, and when.
 *
 * These exist because of a live test that went wrong. The backend fired
 * `escalate_kind: "distress"` at someone saying they were behind on their
 * mortgage, and the app rendered a suicide-hotline card over a financial
 * conversation — and because escalation was sticky, it stayed there for the
 * rest of the session.
 *
 * Two separate failures, both held here:
 *   1. crisis copy appearing for a non-crisis handoff, and
 *   2. one turn's escalation outliving the turn it came from.
 */

/** A backend that answers with whatever escalation the test asks for. */
function backendSaying(replies: { reply: string; escalate?: unknown; escalate_kind?: string }[]) {
  let index = 0;
  return new ApiClient({
    config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
    fetchImpl: (async () => {
      const next = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ conversation_id: 'c-1', ...next }),
      } as Response;
    }) as unknown as typeof fetch,
  });
}

describe('escalate_kind: none renders a clean conversation', () => {
  it('shows the reply with no handoff card at all', async () => {
    const client = backendSaying([
      { reply: 'Tell me more about what is worrying you.', escalate: false, escalate_kind: 'none' },
    ]);
    await renderApp({ client });

    await sayToAi('I am behind on my mortgage.');

    await waitFor(() =>
      expect(screen.getByText('Tell me more about what is worrying you.')).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
    expect(screen.queryByTestId(CRISIS_RESOURCE_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
  });
});

describe('crisis copy is reserved for genuine distress', () => {
  it('shows 988 when the backend says distress', async () => {
    const client = backendSaying([
      { reply: 'I want to stop and say something.', escalate: true, escalate_kind: 'distress' },
    ]);
    await renderApp({ client });

    await sayToAi('I do not want to be here anymore.');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(onTop(CRISIS_RESOURCE_TEST_ID)).toBeOnTheScreen();
    expect(screen.getByText(/988/)).toBeOnTheScreen();
  });

  it('shows NO crisis copy for a support handoff', async () => {
    const client = backendSaying([
      { reply: 'That is a hard spot to be in.', escalate: true, escalate_kind: 'support' },
    ]);
    await renderApp({ client });

    await sayToAi('I am behind on my mortgage and it is stressing me out.');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    // The offer is there. The suicide hotline is not.
    expect(screen.queryByTestId(CRISIS_RESOURCE_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
    expect(screen.queryByText(/Suicide/i)).toBeNull();
    expect(screen.queryByText(/immediate danger/i)).toBeNull();
  });

  it('shows NO crisis copy for a licensed handoff', async () => {
    const client = backendSaying([
      { reply: 'That needs someone licensed.', escalate: true, escalate_kind: 'licensed' },
    ]);
    await renderApp({ client });

    await sayToAi('What does the contract legally require me to disclose?');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.queryByTestId(CRISIS_RESOURCE_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
  });

  it('does not treat a bare escalate:true as a crisis', async () => {
    // A backend that sends only the boolean means "someone should help", not
    // "this person is in danger". Guessing crisis from an ambiguous signal is
    // the mistake this whole file exists to prevent.
    const client = backendSaying([{ reply: 'Let me help with that.', escalate: true }]);
    await renderApp({ client });

    await sayToAi('This is getting complicated.');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.queryByTestId(CRISIS_RESOURCE_TEST_ID)).toBeNull();
  });
});

describe('an escalation belongs to its turn, not to the session', () => {
  it('clears the card when the next turn is none', async () => {
    const client = backendSaying([
      { reply: 'I want to stop and say something.', escalate: true, escalate_kind: 'distress' },
      { reply: 'Understood — tell me more.', escalate: false, escalate_kind: 'none' },
    ]);
    await renderApp({ client });

    await sayToAi('Something heavy.');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());

    // A false positive should cost one turn, not the rest of the conversation.
    await sayToAi('Actually I am fine, I just meant the mortgage.');
    await waitFor(() =>
      expect(screen.getByText('Understood — tell me more.')).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
  });

  it('replaces a support offer with a crisis card when things get worse', async () => {
    const client = backendSaying([
      { reply: 'That is hard.', escalate: true, escalate_kind: 'support' },
      { reply: 'I want to stop and say something.', escalate: true, escalate_kind: 'distress' },
    ]);
    await renderApp({ client });

    await sayToAi('I am behind on payments.');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.queryByTestId(CRISIS_RESOURCE_TEST_ID)).toBeNull();

    await sayToAi('Honestly I do not want to be here anymore.');
    await waitFor(() => expect(onTop(CRISIS_RESOURCE_TEST_ID)).toBeOnTheScreen());
  });
});

describe('the handoff is never a standing escape route', () => {
  it('offers nothing to tap toward a human on an ordinary turn', async () => {
    const client = backendSaying([
      { reply: 'Tell me more.', escalate: false, escalate_kind: 'none' },
    ]);
    await renderApp({ client });
    await sayToAi('Just exploring for now.');

    await waitFor(() => expect(screen.getByText('Tell me more.')).toBeOnTheScreen());
    expect(screen.queryByText(/get a human/i)).toBeNull();
    expect(screen.queryByText(/talk to a (human|person)/i)).toBeNull();
    expect(screen.queryByTestId('escalation-accept')).toBeNull();
  });
});
