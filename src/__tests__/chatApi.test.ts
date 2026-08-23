import { ApiClient } from '../api/client';
import { normalizeEscalation, readEscalationNote, sendChatMessage } from '../api/chat';
import { OPENING_MESSAGE, echoFragment, newStubConversation, stubReply } from '../api/chatStub';

function clientFor(handler: (path: string, body: unknown) => unknown, status = 200) {
  const seen: { path: string; body: unknown }[] = [];
  const client = new ApiClient({
    config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
    fetchImpl: (async (input: unknown, init?: { body?: string }) => {
      const path = String(input).replace(/^https?:\/\/[^/]+/, '');
      const body = init?.body !== undefined ? JSON.parse(init.body) : undefined;
      seen.push({ path, body });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => handler(path, body),
      } as Response;
    }) as unknown as typeof fetch,
  });
  return { client, seen };
}

describe('POST /v1/chat', () => {
  it('omits conversation_id on the first message and sends it after', async () => {
    const { client, seen } = clientFor(() => ({ conversation_id: 'c-1', reply: 'ok' }));

    const first = await sendChatMessage(client, { conversationId: null, message: 'hello' });
    expect(seen[0].path).toBe('/v1/chat');
    expect(seen[0].body).toEqual({ message: 'hello' });
    expect(first.conversationId).toBe('c-1');

    await sendChatMessage(client, { conversationId: 'c-1', message: 'more' });
    expect(seen[1].body).toEqual({ conversation_id: 'c-1', message: 'more' });
  });

  it('reads the reply and the escalation together', async () => {
    const { client } = clientFor(() => ({
      conversation_id: 'c-2',
      reply: 'I hear you.',
      escalate: { kind: 'distress', reason: 'Said they feel hopeless.' },
    }));

    const reply = await sendChatMessage(client, { conversationId: null, message: 'hi' });
    expect(reply.reply).toBe('I hear you.');
    expect(reply.escalate).toBe('distress');
    expect(reply.escalationNote).toBe('Said they feel hopeless.');
  });
});

describe('reading the escalate field', () => {
  it('treats absence as nobody needed', () => {
    expect(normalizeEscalation(undefined)).toBe('none');
    expect(normalizeEscalation(null)).toBe('none');
    expect(normalizeEscalation(false)).toBe('none');
    expect(normalizeEscalation('none')).toBe('none');
  });

  it('understands the kinds it knows', () => {
    expect(normalizeEscalation('support')).toBe('support');
    expect(normalizeEscalation('LICENSED')).toBe('licensed');
    expect(normalizeEscalation({ kind: 'distress' })).toBe('distress');
    expect(normalizeEscalation({ type: 'support' })).toBe('support');
  });

  /**
   * The safe direction to fail. If the backend is signalling something we
   * cannot parse, offering help is a smaller mistake than swallowing it.
   */
  it('falls back to offering help rather than to silence', () => {
    expect(normalizeEscalation(true)).toBe('support');
    expect(normalizeEscalation('something-new')).toBe('support');
    expect(normalizeEscalation({ reason: 'unspecified' })).toBe('support');
    expect(normalizeEscalation(42)).toBe('support');
  });

  it('picks up a reason wherever the backend puts it', () => {
    expect(readEscalationNote({ reason: '  needs a person  ' })).toBe('needs a person');
    expect(readEscalationNote({ note: 'licensed only' })).toBe('licensed only');
    expect(readEscalationNote('support', 'from the sibling field')).toBe('from the sibling field');
    expect(readEscalationNote(undefined, '   ')).toBeUndefined();
  });
});

describe('the local stub, until the endpoint exists', () => {
  it('opens by asking about the person, not the property', () => {
    expect(OPENING_MESSAGE).toMatch(/what's on your mind/i);
    expect(OPENING_MESSAGE).toMatch(/before we talk about anything to do with property/i);
  });

  it('never mentions the fee or the listing process, across the whole arc', () => {
    let conversation = newStubConversation();
    const said = [
      'I need to move.',
      'My mother passed the house to me.',
      'Probably in the next six months.',
      'I want it done without drama.',
      'Nothing else really.',
      'Thanks.',
    ];

    const replies: string[] = [OPENING_MESSAGE];
    for (const message of said) {
      const result = stubReply(conversation, message);
      conversation = result.next;
      replies.push(result.reply.reply);
    }

    const transcript = replies.join('\n').toLowerCase();
    for (const forbidden of ['1%', 'listing fee', 'commission', 'list your home', 'seller']) {
      expect(`${forbidden}: ${transcript.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('asks a question on every discovery turn', () => {
    let conversation = newStubConversation();
    for (const message of ['a', 'b', 'c', 'd']) {
      const result = stubReply(conversation, message);
      conversation = result.next;
      expect(result.reply.reply).toMatch(/\?/);
    }
  });

  it('reflects the person’s own words back to them', () => {
    const result = stubReply(newStubConversation(), 'I am relocating for work in the spring');
    expect(result.reply.reply).toMatch(/relocating for work in the spring/);
  });

  it('keeps the reflected fragment short enough to read', () => {
    const long = `I have been thinking about this for a very long time ${'and more '.repeat(30)}`;
    expect(echoFragment(long).length).toBeLessThanOrEqual(90);
    expect(echoFragment('One thing. Another thing.')).toBe('One thing');
  });

  it('does not escalate an ordinary conversation', () => {
    let conversation = newStubConversation();
    for (const message of ['Thinking about a move', 'Maybe next year', 'Not sure yet']) {
      const result = stubReply(conversation, message);
      conversation = result.next;
      expect(result.reply.escalate).toBe('none');
    }
  });

  it('offers support for a hard circumstance', () => {
    for (const message of [
      'We are in foreclosure',
      'My husband died in March',
      'I lost my job and I am behind on payments',
    ]) {
      expect(stubReply(newStubConversation(), message).reply.escalate).toBe('support');
    }
  });

  it('hands legal and contract questions to a licensed person', () => {
    expect(stubReply(newStubConversation(), 'What does the contract require?').reply.escalate).toBe(
      'licensed',
    );
  });

  it('treats crisis language as crisis, above everything else', () => {
    for (const message of [
      'I want to die',
      'I have been thinking about suicide',
      "I don't want to live anymore",
    ]) {
      const result = stubReply(newStubConversation(), message);
      expect(result.reply.escalate).toBe('distress');
      // Nothing about property sits next to someone in crisis.
      expect(result.reply.reply.toLowerCase()).not.toMatch(/property|house|home|sell/);
    }
  });

  it('puts crisis ahead of a hardship mentioned in the same breath', () => {
    const result = stubReply(
      newStubConversation(),
      'We are facing foreclosure and I do not want to live anymore',
    );
    expect(result.reply.escalate).toBe('distress');
  });
});
