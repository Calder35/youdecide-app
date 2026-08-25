import { streamRequest } from '../api/streamRequest';
import { createEventStreamParser } from '../api/eventStream';

/**
 * Reading a response as it arrives, on React Native.
 *
 * These exist because the failure this code avoids DOES NOT THROW. React
 * Native's `fetch` has no streaming support, so the obvious implementation
 * works perfectly against a streaming endpoint and simply delivers the whole
 * reply at the end — no error, no warning, just the latency back. The rules
 * below are the ones that silently stop mattering if someone "tidies" them.
 */

/** A fake XMLHttpRequest that a test drives one piece at a time. */
class FakeXHR {
  readyState = 0;
  status = 0;
  responseText = '';
  onreadystatechange: (() => void) | null = null;
  onprogress: (() => void) | null = null;
  aborted = false;
  sent = false;
  /** What `onreadystatechange` was when `send()` ran. RN snapshots it there. */
  handlerAtSendTime: unknown = undefined;
  opened: { method: string; url: string } | null = null;
  headers: Record<string, string> = {};
  body: string | undefined;

  open(method: string, url: string) {
    this.opened = { method, url };
    this.readyState = 1;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body?: string) {
    this.sent = true;
    this.body = body;
    this.handlerAtSendTime = this.onreadystatechange;
  }

  abort() {
    this.aborted = true;
  }

  /** Server pushes another piece. `responseText` ACCUMULATES, as RN's does. */
  emit(text: string, status = 200) {
    this.status = status;
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

/**
 * Streams left open at the end of a test still hold an armed idle timer, which
 * keeps Jest's event loop alive. Cancelling them is the test's job, not the
 * transport's — in the app a stream always ends, one way or another.
 */
const open: { cancel: () => void }[] = [];
afterEach(() => {
  for (const handle of open.splice(0)) handle.cancel();
});

function start(overrides: Parameters<typeof streamRequest>[0] extends never ? never : object = {}) {
  const xhr = new FakeXHR();
  const chunks: string[] = [];
  const errors: unknown[] = [];
  let done = false;

  const handle = streamRequest(
    {
      url: 'http://localhost:8000/v1/chat/stream',
      body: { message: 'hello' },
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
      ...overrides,
    },
    {
      onChunk: (text) => chunks.push(text),
      onDone: () => {
        done = true;
      },
      onError: (error) => errors.push(error),
    },
  );

  open.push(handle);
  return { xhr, chunks, errors, handle, isDone: () => done };
}

describe('the rules that fail silently', () => {
  /**
   * RULE 1, and the reason this file uses XHR at all. React Native computes
   * `incrementalEvents` INSIDE `send()` from whether a handler is attached. Set
   * it one line later and the native layer never streams — you get one delivery
   * at the end, exactly like fetch, with nothing to tell you.
   */
  it('attaches the readystate handler BEFORE send, or nothing streams', () => {
    const { xhr } = start();
    expect(xhr.sent).toBe(true);
    expect(xhr.handlerAtSendTime).not.toBeNull();
    expect(xhr.handlerAtSendTime).toBe(xhr.onreadystatechange);
  });

  /**
   * RULE 2. `responseText` throws for any responseType other than '' or 'text',
   * so nothing here may set one.
   */
  it('never sets a responseType', () => {
    const { xhr } = start();
    expect('responseType' in xhr).toBe(false);
  });

  /**
   * RULE 3. `responseText` is everything so far, not the latest piece. Handing
   * it over whole would replay the entire reply on every event — the same
   * sentence spoken again and again.
   */
  it('reports only what is NEW, never the whole response again', () => {
    const { xhr, chunks } = start();

    xhr.emit('one');
    xhr.emit('two');
    xhr.emit('three');

    expect(chunks).toEqual(['one', 'two', 'three']);
    expect(chunks.join('')).toBe(xhr.responseText);
  });
});

describe('delivering a stream', () => {
  it('hands over pieces as they arrive, not at the end', () => {
    const { xhr, chunks, isDone } = start();

    xhr.emit('{"type":"sentence","text":"first"}\n');

    // The point: readable before the response has completed.
    expect(chunks).toHaveLength(1);
    expect(isDone()).toBe(false);
  });

  it('picks up anything left over when the response completes', () => {
    const { xhr, chunks, isDone } = start();

    xhr.emit('partial');
    xhr.responseText += ' and the rest';
    xhr.complete();

    expect(chunks).toEqual(['partial', ' and the rest']);
    expect(isDone()).toBe(true);
  });

  it('still works when the response was not streamed at all', () => {
    // A proxy that buffered the whole thing, or a server that did not stream.
    // Slower, but it must not break — everything arrives at readyState 4.
    const { xhr, chunks, isDone } = start();

    xhr.status = 200;
    xhr.responseText = 'the whole reply at once';
    xhr.complete();

    expect(chunks).toEqual(['the whole reply at once']);
    expect(isDone()).toBe(true);
  });

  it('sends the body as JSON to the right place', () => {
    const { xhr } = start();
    expect(xhr.opened).toEqual({
      method: 'POST',
      url: 'http://localhost:8000/v1/chat/stream',
    });
    expect(JSON.parse(xhr.body ?? '{}')).toEqual({ message: 'hello' });
  });
});

describe('when it goes wrong', () => {
  it('reports an HTTP failure rather than feeding the error body to the parser', () => {
    const { xhr, chunks, errors } = start();

    // A 500 still has a body. Draining it would push the error JSON downstream
    // as though it were something to say out loud.
    xhr.emit('{"detail":"boom"}', 500);
    xhr.complete(500);

    expect(chunks).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('calls a dropped connection what it is', () => {
    const { xhr, errors } = start();
    xhr.emit('half a sen');
    xhr.complete(0); // transport died — no HTTP status at all

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toMatch(/connection|network/i);
  });

  it('gives up when nothing new arrives for too long', async () => {
    const { xhr, errors } = start({ idleTimeoutMs: 20 });

    xhr.emit('a sentence, then silence');
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(errors).toHaveLength(1);
    expect(xhr.aborted).toBe(true);
  });

  it('does not time out while data is still flowing', async () => {
    const { xhr, errors } = start({ idleTimeoutMs: 40 });

    // The idle clock has to RESET on each piece. A total timeout would cut off
    // a long reply that is arriving perfectly well.
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      xhr.emit(`piece ${i} `);
    }

    expect(errors).toEqual([]);
  });

  it('stops cleanly when cancelled, and says nothing afterwards', () => {
    const { xhr, chunks, errors, handle, isDone } = start();

    xhr.emit('one');
    handle.cancel();
    xhr.emit('two');
    xhr.complete();

    expect(xhr.aborted).toBe(true);
    expect(chunks).toEqual(['one']);
    expect(errors).toEqual([]);
    expect(isDone()).toBe(false);
  });
});

/**
 * The two halves together — the transport does not care what the bytes mean,
 * and the parser does not care where they came from.
 */
describe('transport feeding the parser', () => {
  it('survives an event split across two network pieces', () => {
    const { xhr, chunks } = start();
    const parser = createEventStreamParser();
    const sentences: string[] = [];

    const feed = () => {
      for (const chunk of chunks.splice(0)) {
        for (const event of parser.push(chunk)) {
          if (typeof event.data.text === 'string') sentences.push(event.data.text);
        }
      }
    };

    // The network decides where a packet ends, not the sender.
    xhr.emit('data: {"type":"sentence","tex');
    feed();
    expect(sentences).toEqual([]); // nothing whole yet — and nothing mangled

    xhr.emit('t":"That happens a lot."}\n');
    feed();
    expect(sentences).toEqual(['That happens a lot.']);
  });
});
