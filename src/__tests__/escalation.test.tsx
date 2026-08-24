import { screen, waitFor } from '@testing-library/react-native';

import { ApiClient } from '../api/client';
import { ESCALATION_TEST_ID } from '../components/EscalationOffer';
import { SAFETY_NOTICE_TEST_ID } from '../components/SafetyNotice';
import { onTop, renderApp, sayToAi } from '../test-utils/renderApp';

/**
 * What the housing conversation is allowed to put in front of someone.
 *
 * THIS IS A HOUSING PRODUCT. Being behind on a mortgage or facing foreclosure
 * is an ordinary business situation, handled in discovery. It is not a crisis,
 * and it must never produce an emotional card, a hotline, or "let's get a
 * person with you".
 *
 * A live test produced exactly that — a suicide-hotline card at someone talking
 * about mortgage arrears, which then stuck for the rest of the session. These
 * tests hold the three rules that came out of it:
 *   1. `none` renders nothing at all,
 *   2. the only card in the housing flow is a professional, service-framed
 *      handoff with no emotional or crisis language anywhere in it,
 *   3. an escalation belongs to its turn, not to the session.
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
    expect(screen.queryByTestId(SAFETY_NOTICE_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
  });

  it('renders no card for mortgage arrears — the situation this product is for', async () => {
    const client = backendSaying([
      {
        reply: 'How far behind are you, and has the lender been in touch?',
        escalate: false,
        escalate_kind: 'none',
      },
    ]);
    await renderApp({ client });

    await sayToAi('I am three months behind on my mortgage and worried about foreclosure.');

    await waitFor(() =>
      expect(
        screen.getByText('How far behind are you, and has the lender been in touch?'),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
    expect(screen.queryByTestId(SAFETY_NOTICE_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
    expect(screen.queryByText(/get a person with you/i)).toBeNull();
  });
});

describe('the only card in the housing flow is a professional handoff', () => {
  const CRISIS_LANGUAGE = [/988/, /suicide/i, /crisis/i, /immediate danger/i, /on your own/i];

  it('frames a licensed handoff as service, with no emotional language', async () => {
    const client = backendSaying([
      { reply: 'That needs someone licensed.', escalate: true, escalate_kind: 'licensed' },
    ]);
    await renderApp({ client });

    await sayToAi('What does the contract legally require me to disclose?');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.getByText(/A licensed teammate can take this step/)).toBeOnTheScreen();
    expect(screen.getByText(/Hand this step to a teammate/)).toBeOnTheScreen();

    for (const pattern of CRISIS_LANGUAGE) {
      expect(`${pattern} -> ${screen.queryAllByText(pattern).length}`).toBe(`${pattern} -> 0`);
    }
  });

  it('uses the same professional card when the backend says support', async () => {
    const client = backendSaying([
      { reply: 'Let me get someone onto that.', escalate: true, escalate_kind: 'support' },
    ]);
    await renderApp({ client });

    await sayToAi('This is getting complicated.');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.getByText(/A licensed teammate can take this step/)).toBeOnTheScreen();
    for (const pattern of CRISIS_LANGUAGE) {
      expect(`${pattern} -> ${screen.queryAllByText(pattern).length}`).toBe(`${pattern} -> 0`);
    }
  });

  it('never renders an emotional card, whatever the backend sends', async () => {
    for (const kind of ['none', 'support', 'licensed'] as const) {
      const client = backendSaying([{ reply: 'Understood.', escalate: true, escalate_kind: kind }]);
      await renderApp({ client });
      await sayToAi('I cannot afford the payments any more.');
      await waitFor(() => expect(screen.getByText('Understood.')).toBeOnTheScreen());

      expect(`${kind}: ${screen.queryAllByText(/Let's get a person with you/i).length}`).toBe(
        `${kind}: 0`,
      );
      expect(`${kind}: ${screen.queryAllByTestId(SAFETY_NOTICE_TEST_ID).length}`).toBe(`${kind}: 0`);
    }
  });

  it('does not treat a bare escalate:true as distress', async () => {
    const client = backendSaying([{ reply: 'Let me help with that.', escalate: true }]);
    await renderApp({ client });

    await sayToAi('This is getting complicated.');

    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());
    expect(screen.queryByTestId(SAFETY_NOTICE_TEST_ID)).toBeNull();
  });
});

describe('safety copy is separate, and out of the housing flow', () => {
  it('appears only when the backend explicitly says distress', async () => {
    const client = backendSaying([
      { reply: 'I want to stop and say something.', escalate: true, escalate_kind: 'distress' },
    ]);
    await renderApp({ client });

    await sayToAi('I do not want to be here anymore.');

    await waitFor(() => expect(onTop(SAFETY_NOTICE_TEST_ID)).toBeOnTheScreen());
    // It is its own notice, not the handoff card.
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
  });
});

describe('an escalation belongs to its turn, not to the session', () => {
  it('clears the card when the next turn is none', async () => {
    const client = backendSaying([
      { reply: 'That needs someone licensed.', escalate: true, escalate_kind: 'licensed' },
      { reply: 'Understood — tell me more.', escalate: false, escalate_kind: 'none' },
    ]);
    await renderApp({ client });

    await sayToAi('Something about the contract.');
    await waitFor(() => expect(onTop(ESCALATION_TEST_ID)).toBeOnTheScreen());

    // A false positive should cost one turn, not the rest of the conversation.
    await sayToAi('Actually I am fine, I just meant the mortgage.');
    await waitFor(() =>
      expect(screen.getByText('Understood — tell me more.')).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId(ESCALATION_TEST_ID)).toBeNull();
    expect(screen.queryByText(/988/)).toBeNull();
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
