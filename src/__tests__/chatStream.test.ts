import { ApiClient } from '../api/client';
import {
  CHAT_STREAM_PATH,
  isDone,
  readSentence,
  readStreamError,
  streamChatMessage,
} from '../api/chatStream';

/**
 * The seam between the stream and the conversation.
 *
 * The backend's exact event shapes are not final, so these hold the two things
 * that must be true whatever it settles on: sentences reach the speaker THE
 * MOMENT they arrive, and the escalation from the final event is applied to the
 * turn. The field-name tolerance is deliberate — `chat.ts` already reads
 * escalation loosely for the same reason, and a stream that half-works because
 * one key was spelled differently is a bad afternoon.
 */

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
 * A stream a test never finished still holds an armed idle timer. Left alone it
 * fires after the run and rejects with nobody listening, which takes the whole
 * process down — so every stream a test opens gets cancelled.
 */
const open: { cancel: () => void }[] = [];

beforeEach(() => {
  FakeXHR.latest = null;
  (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
});

afterEach(() => {
  for (const handle of open.splice(0)) handle.cancel();
  (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXHR;
});

function connectedClient() {
  return new ApiClient({ config: { mode: 'test-api', baseUrl: 'http://localhost:8000' } });
}

function begin(message = 'I am behind on my mortgage.') {
  const sentences: string[] = [];
  const { result, cancel } = streamChatMessage(
    connectedClient(),
    { conversationId: null, message, mode: 'voice' },
    { onSentence: (sentence) => sentences.push(sentence) },
  );
  const xhr = FakeXHR.latest;
  if (xhr === null) throw new Error('no request was made');
  open.push({ cancel });
  // Tests that assert on the request alone never await the result; an
  // unobserved rejection must not outlive them.
  result.catch(() => undefined);
  return { result, cancel, sentences, xhr };
}

describe('what it asks the backend for', () => {
  it('posts the turn to the streaming endpoint', () => {
    const { xhr } = begin();
    expect(xhr.opened?.method).toBe('POST');
    expect(xhr.opened?.url).toBe(`http://localhost:8000${CHAT_STREAM_PATH}`);
  });

  it('marks it as a spoken turn, so the reply is short enough to listen to', () => {
    const { xhr } = begin();
    expect(JSON.parse(xhr.body ?? '{}')).toMatchObject({ mode: 'voice' });
  });

  it('asks for server-sent events, which is what the endpoint sends', () => {
    const { xhr } = begin();
    expect(xhr.headers.Accept).toMatch(/event-stream/);
  });

  it('refuses to stream with no backend, rather than pretending', async () => {
    const offline = new ApiClient({ config: { mode: 'offline', baseUrl: '' } });
    const { result } = streamChatMessage(
      offline,
      { conversationId: null, message: 'hello' },
      { onSentence: () => undefined },
    );
    await expect(result).rejects.toBeDefined();
  });
});

describe('sentences reach the speaker as they land', () => {
  /** The whole point: not buffered until the reply is complete. */
  it('reports each sentence before the stream has finished', async () => {
    const { xhr, sentences, result } = begin();

    xhr.emit('{"type":"sentence","text":"That happens a lot."}\n');
    expect(sentences).toEqual(['That happens a lot.']);

    xhr.emit('{"type":"sentence","text":"Has anything come from your lender?"}\n');
    expect(sentences).toHaveLength(2);

    xhr.emit('{"type":"done","conversation_id":"c-1"}\n');
    xhr.complete();
    await result;
  });

  it('assembles the same sentences into one reply for the transcript', async () => {
    const { xhr, result } = begin();

    xhr.emit('{"type":"sentence","text":"One."}\n{"type":"sentence","text":"Two."}\n');
    xhr.emit('{"type":"done","conversation_id":"c-9"}\n');
    xhr.complete();

    const reply = await result;
    expect(reply.reply).toBe('One. Two.');
    expect(reply.conversationId).toBe('c-9');
  });
});

describe('the final event carries the escalation', () => {
  it('applies escalate_kind to the turn', async () => {
    const { xhr, result } = begin();
    xhr.emit('{"type":"sentence","text":"I hear you."}\n');
    xhr.emit('{"type":"done","conversation_id":"c-1","escalate":true,"escalate_kind":"support"}\n');
    xhr.complete();

    expect((await result).escalate).toBe('support');
  });

  it('reads a plain boolean when that is all there is', async () => {
    const { xhr, result } = begin();
    xhr.emit('{"type":"sentence","text":"I hear you."}\n');
    xhr.emit('{"type":"done","escalate":true}\n');
    xhr.complete();

    expect((await result).escalate).toBe('support');
  });

  it('leaves an ordinary turn unescalated', async () => {
    const { xhr, result } = begin();
    xhr.emit('{"type":"sentence","text":"Tell me more."}\n');
    xhr.emit('{"type":"done","escalate":false,"escalate_kind":"none"}\n');
    xhr.complete();

    expect((await result).escalate).toBe('none');
  });

  /**
   * A stream that ends without a `done` is a backend bug, but the sentences
   * were still said out loud. Losing them would be the worse failure.
   */
  it('keeps what was said when the done event never came', async () => {
    const { xhr, result } = begin();
    xhr.emit('{"type":"sentence","text":"Said out loud already."}\n');
    xhr.complete();

    const reply = await result;
    expect(reply.reply).toBe('Said out loud already.');
    expect(reply.endedWithoutDone).toBe(true);
    expect(reply.escalate).toBe('none');
  });
});

describe('it does not fail over a name it did not expect', () => {
  it.each([
    ['text', '{"type":"sentence","text":"hello"}'],
    ['sentence', '{"type":"sentence","sentence":"hello"}'],
    ['delta', '{"type":"delta","delta":"hello"}'],
    ['content', '{"type":"text","content":"hello"}'],
    ['no type at all', '{"text":"hello"}'],
  ])('reads a sentence carried as %s', async (_name, line) => {
    const { xhr, sentences, result } = begin();
    xhr.emit(`${line}\n`);
    xhr.emit('{"type":"done"}\n');
    xhr.complete();
    await result;

    expect(sentences).toEqual(['hello']);
  });

  it.each(['done', 'end', 'complete'])('treats "%s" as the end', (type) => {
    expect(isDone({ type })).toBe(true);
  });

  it('does not mistake a sentence for the end', () => {
    expect(isDone({ type: 'sentence', text: 'not done' })).toBe(false);
  });

  it('ignores an empty sentence rather than speaking silence', () => {
    expect(readSentence({ type: 'sentence', text: '   ' })).toBeNull();
  });
});

describe('when the backend reports a failure mid-stream', () => {
  it('recognises an error event', () => {
    expect(readStreamError({ type: 'error', message: 'model timed out' })).toBe('model timed out');
    expect(readStreamError({ type: 'sentence', text: 'fine' })).toBeNull();
  });

  /**
   * An error arrives as an EVENT once the headers have gone out, and by then
   * some of the reply may already have been spoken out loud. Binning it would
   * be a worse lie than an incomplete answer — the person heard those words
   * either way — so the turn keeps what there is and says the rest stopped.
   */
  it('keeps what was already said, and reports that it stopped early', async () => {
    const { xhr, result } = begin();
    xhr.emit('data: {"type": "sentence", "seq": 0, "text": "I was saying..."}\n\n');
    xhr.emit('data: {"type": "error", "code": "upstream_unavailable", "message": "the model fell over"}\n\n');
    xhr.complete();

    const reply = await result;
    expect(reply.reply).toBe('I was saying...');
    expect(reply.cutShort).toMatch(/fell over/);
  });

  it('fails outright when it produced nothing at all', async () => {
    const { xhr, result } = begin();
    xhr.emit('data: {"type": "error", "code": "empty_reply", "message": "nothing to say"}\n\n');
    xhr.complete();

    await expect(result).rejects.toBeDefined();
  });

  it('fails on an HTTP error', async () => {
    const { xhr, result } = begin();
    xhr.complete(500);
    await expect(result).rejects.toBeDefined();
  });
});
