import { createEventStreamParser } from '../api/eventStream';

/**
 * Reassembling events from a stream that arrives in arbitrary pieces.
 *
 * The parser reads BOTH server-sent events and newline-delimited JSON, because
 * the backend has not settled on one and the difference is a `data: ` prefix.
 * Reading both means the contract landing does not require a change here.
 */

/** Collects the text of every `sentence` event across a series of pieces. */
function sentencesFrom(pieces: string[]): string[] {
  const parser = createEventStreamParser();
  const out: string[] = [];
  for (const piece of pieces) {
    for (const event of parser.push(piece)) {
      if (typeof event.data.text === 'string') out.push(event.data.text);
    }
  }
  for (const event of parser.end()) {
    if (typeof event.data.text === 'string') out.push(event.data.text);
  }
  return out;
}

describe('it reads either wire format', () => {
  it('reads newline-delimited JSON', () => {
    expect(
      sentencesFrom(['{"type":"sentence","text":"one"}\n{"type":"sentence","text":"two"}\n']),
    ).toEqual(['one', 'two']);
  });

  it('reads server-sent events', () => {
    expect(
      sentencesFrom([
        'data: {"type":"sentence","text":"one"}\n\ndata: {"type":"sentence","text":"two"}\n\n',
      ]),
    ).toEqual(['one', 'two']);
  });

  it('reads a stream that mixes them, rather than falling over', () => {
    expect(
      sentencesFrom(['{"type":"sentence","text":"one"}\ndata: {"type":"sentence","text":"two"}\n']),
    ).toEqual(['one', 'two']);
  });
});

describe('pieces do not arrive on tidy boundaries', () => {
  /**
   * The network decides where a packet ends. An event split down the middle is
   * normal, and getting this wrong looks like an endpoint that mangles every
   * other sentence.
   */
  it('holds a half-arrived event until the rest of it lands', () => {
    const parser = createEventStreamParser();

    expect(parser.push('{"type":"sentence","tex')).toEqual([]);
    const finished = parser.push('t":"That happens a lot."}\n');

    expect(finished).toHaveLength(1);
    expect(finished[0].data.text).toBe('That happens a lot.');
  });

  it('handles a split that lands exactly on the newline', () => {
    expect(
      sentencesFrom(['{"type":"sentence","text":"one"}', '\n{"type":"sentence","text":"two"}\n']),
    ).toEqual(['one', 'two']);
  });

  it('reassembles a stream delivered one character at a time', () => {
    const whole = '{"type":"sentence","text":"one"}\n{"type":"sentence","text":"two"}\n';
    expect(sentencesFrom(whole.split(''))).toEqual(['one', 'two']);
  });

  it('takes several events out of a single piece', () => {
    const parser = createEventStreamParser();
    const events = parser.push(
      '{"type":"sentence","text":"a"}\n{"type":"sentence","text":"b"}\n{"type":"done"}\n',
    );
    expect(events).toHaveLength(3);
  });
});

describe('what it ignores', () => {
  it('skips keep-alive comments, blank lines, and SSE metadata', () => {
    expect(
      sentencesFrom([
        ': keep-alive\n\nevent: message\nid: 7\nretry: 1000\ndata: {"type":"sentence","text":"real"}\n\n',
      ]),
    ).toEqual(['real']);
  });

  it('skips the [DONE] sentinel without trying to parse it', () => {
    expect(sentencesFrom(['data: {"type":"sentence","text":"real"}\ndata: [DONE]\n'])).toEqual([
      'real',
    ]);
  });

  /**
   * One malformed line should cost one sentence, not the rest of the reply.
   * Somebody is listening to this; going silent because of a stray byte is
   * worse than a small gap.
   */
  it('reports a bad line and carries on with the good ones', () => {
    const bad: string[] = [];
    const parser = createEventStreamParser({ onUnparseable: (line) => bad.push(line) });

    const events = [
      ...parser.push('{"type":"sentence","text":"before"}\n'),
      ...parser.push('{ this is not json\n'),
      ...parser.push('{"type":"sentence","text":"after"}\n'),
    ];

    expect(events.map((e) => e.data.text)).toEqual(['before', 'after']);
    expect(bad).toHaveLength(1);
  });

  it('does not accept a bare JSON array as an event', () => {
    const bad: string[] = [];
    const parser = createEventStreamParser({ onUnparseable: (line) => bad.push(line) });
    expect(parser.push('[1,2,3]\n')).toEqual([]);
    expect(bad).toHaveLength(1);
  });
});

describe('the last event', () => {
  /**
   * A sender that forgets the trailing newline would otherwise cost us the
   * `done` event — the one carrying the escalation.
   */
  it('is not lost when the stream ends without a newline', () => {
    const parser = createEventStreamParser();
    expect(parser.push('{"type":"done","escalate_kind":"support"}')).toEqual([]);

    const flushed = parser.end();
    expect(flushed).toHaveLength(1);
    expect(flushed[0].data.escalate_kind).toBe('support');
  });

  it('flushes nothing when the stream ended tidily', () => {
    const parser = createEventStreamParser();
    parser.push('{"type":"done"}\n');
    expect(parser.end()).toEqual([]);
  });
});
