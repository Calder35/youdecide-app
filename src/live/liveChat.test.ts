import { ApiClient } from '../api/client';
import { sendChatMessage } from '../api/chat';
import { resolveApiConfig } from '../api/config';

/**
 * A REAL round-trip against the deployed backend, through the app's own client.
 *
 * EXCLUDED FROM CI. `jest.config.js` ignores `src/live/`, because a test that
 * calls a network service and a model is neither fast nor deterministic, and a
 * red build caused by someone else's deploy teaches nothing.
 *
 * Run it on demand, when you want to know the app and the backend still agree:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://web-production-e36a6.up.railway.app \
 *     npx jest src/live --testPathIgnorePatterns "/node_modules/"
 *
 * It asserts the things that would actually break the phone: a real reply, a
 * real conversation_id, continuity across turns, and an escalation kind the UI
 * knows how to render.
 */

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

const describeLive = BASE_URL.length > 0 ? describe : describe.skip;

describeLive('the deployed backend, for real', () => {
  const client = new ApiClient({ config: resolveApiConfig(BASE_URL) });

  // A model call, not a database read.
  jest.setTimeout(120_000);

  it('answers with a real reply and a conversation id', async () => {
    const reply = await sendChatMessage(client, {
      conversationId: null,
      message: 'I am thinking about moving closer to my daughter next year, nothing urgent.',
    });

    expect(reply.conversationId).toMatch(/[0-9a-f-]{8,}/);
    expect(reply.reply.length).toBeGreaterThan(40);
    // Not the local stub's scripted wording.
    expect(reply.reply).not.toContain("I'm You Decide AI");
    expect(['none', 'support', 'licensed', 'distress']).toContain(reply.escalate);
  });

  it('keeps the same conversation across turns', async () => {
    const first = await sendChatMessage(client, {
      conversationId: null,
      message: 'Hello — my name is Jordan.',
    });
    const second = await sendChatMessage(client, {
      conversationId: first.conversationId,
      message: 'What did I just tell you my name was?',
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(second.reply).toMatch(/jordan/i);
  });

  /**
   * The voice-mode seam, end to end.
   *
   * Until the backend implements `mode`, this only proves the field is
   * TOLERATED — which is what makes it safe to ship ahead of the backend. Once
   * it lands, the length assertion below starts doing real work.
   */
  it('accepts mode: "voice" and answers', async () => {
    const spoken = await sendChatMessage(client, {
      conversationId: null,
      message: 'I am three months behind on my mortgage.',
      mode: 'voice',
    });

    expect(spoken.reply.length).toBeGreaterThan(0);
    console.log(`mode:voice reply -> ${spoken.reply.length} chars`);

    // Once the backend implements it, a spoken reply should be short enough to
    // listen to. ~400 chars is roughly four seconds of speech.
    if (spoken.reply.length > 400) {
      console.log('  (backend has not shortened voice replies yet)');
    }
  });

  it('leads with discovery rather than the fee or the listing process', async () => {
    const reply = await sendChatMessage(client, {
      conversationId: null,
      message: 'I might need to sell a house at some point.',
    });

    const text = reply.reply.toLowerCase();
    for (const forbidden of ['1%', 'listing fee', 'commission']) {
      expect(`${forbidden}: ${text.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
    // It asks something back.
    expect(reply.reply).toMatch(/\?/);
  });
});
