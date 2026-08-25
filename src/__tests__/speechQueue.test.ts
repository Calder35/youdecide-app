import { createSpeechQueue } from '../voice/speechQueue';
import { FIRST_CHUNK_CHARS } from '../voice/speechChunks';
import type { VoiceError } from '../voice/types';

/**
 * Speaking a reply that is still being written.
 *
 * The behaviour that matters: text pushed in at any time comes out as audio in
 * the order it went in, and the first piece starts playing without waiting for
 * the last one to exist. That second half is the entire reason streaming buys
 * anything.
 */

type Harness = ReturnType<typeof harness>;

function harness(options: { synthesizeDelayMs?: number; playDelayMs?: number } = {}) {
  const synthesized: string[] = [];
  const played: string[] = [];
  const errors: VoiceError[] = [];

  const synthesize = jest.fn(async (text: string) => {
    synthesized.push(text);
    if (options.synthesizeDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.synthesizeDelayMs));
    }
    return { uri: `file:///tmp/${synthesized.length}.mp3`, mimeType: 'audio/mpeg' };
  });

  const play = jest.fn(async (uri: string) => {
    if (options.playDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.playDelayMs));
    }
    played.push(uri);
  });

  const firstSound: { elapsedMs: number; pieces: number }[] = [];

  const queue = createSpeechQueue({
    synthesize,
    play,
    onError: (error) => errors.push(error),
    onFirstSound: (elapsedMs, pieces) => firstSound.push({ elapsedMs, pieces }),
  });

  return { queue, synthesize, play, synthesized, played, errors, firstSound };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('pushing the whole reply at once', () => {
  it('behaves exactly as it did before streaming existed', async () => {
    const h = harness();
    h.queue.push('That happens a lot, and there are real options.');
    h.queue.end();
    await h.queue.done;

    expect(h.synthesized).toEqual(['That happens a lot, and there are real options.']);
    expect(h.played).toHaveLength(1);
    expect(h.errors).toEqual([]);
  });

  it('still splits a long reply, keeping the opening piece short', async () => {
    const h = harness();
    h.queue.push(LONG_REPLY);
    h.queue.end();
    await h.queue.done;

    expect(h.synthesized.length).toBeGreaterThan(1);
    expect(h.synthesized[0].length).toBeLessThanOrEqual(FIRST_CHUNK_CHARS);
  });
});

describe('pushing sentences as they arrive', () => {
  /**
   * THE POINT OF THE WHOLE EXERCISE. Sentence one is synthesised and spoken
   * while sentence two has not been written yet.
   */
  it('starts speaking before the rest of the reply exists', async () => {
    const h = harness();

    h.queue.push('That happens a lot.');
    await settle();

    expect(h.played).toHaveLength(1);
    expect(h.firstSound).toHaveLength(1);

    // Only now does the model finish the thought.
    h.queue.push('Has anything come from your lender yet?');
    h.queue.end();
    await h.queue.done;

    expect(h.played).toHaveLength(2);
  });

  it('speaks in the order the sentences arrived, never the order they finished', async () => {
    // First synthesis is the slow one. Playing whichever came back first would
    // reorder somebody's answer.
    const slowFirst = jest.fn(async (text: string) => {
      await new Promise((resolve) => setTimeout(resolve, text === 'first' ? 40 : 1));
      return { uri: `file:///tmp/${text}.mp3`, mimeType: 'audio/mpeg' };
    });

    const played: string[] = [];
    const queue = createSpeechQueue({
      synthesize: slowFirst,
      play: async (uri) => {
        played.push(uri);
      },
      onError: () => undefined,
    });

    queue.push('first');
    queue.push('second');
    queue.push('third');
    queue.end();
    await queue.done;

    expect(played).toEqual([
      'file:///tmp/first.mp3',
      'file:///tmp/second.mp3',
      'file:///tmp/third.mp3',
    ]);
  });

  it('synthesises ahead rather than waiting for each piece to finish playing', async () => {
    const h = harness({ playDelayMs: 30 });

    h.queue.push('one');
    h.queue.push('two');
    h.queue.push('three');
    h.queue.end();

    // While the first is still playing, later pieces are already being made.
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(h.synthesized.length).toBeGreaterThan(1);

    await h.queue.done;
    expect(h.played).toHaveLength(3);
  });

  it('waits patiently when nothing has arrived yet', async () => {
    const h = harness();
    await settle();
    expect(h.played).toEqual([]);

    h.queue.push('finally');
    h.queue.end();
    await h.queue.done;

    expect(h.played).toHaveLength(1);
  });

  it('gives only the FIRST piece the tight opening budget', async () => {
    const h = harness();
    // A long second sentence should not be chopped to 110 characters — by then
    // the sound has already started and the seams matter more.
    h.queue.push('Short opener.');
    h.queue.push(LONG_SENTENCE);
    h.queue.end();
    await h.queue.done;

    expect(h.synthesized[0]).toBe('Short opener.');
    expect(h.synthesized[1].length).toBeGreaterThan(FIRST_CHUNK_CHARS);
  });
});

describe('when speaking fails', () => {
  it('reports it and resolves, rather than failing the turn', async () => {
    const queue = createSpeechQueue({
      synthesize: async () => {
        throw new Error('tts down');
      },
      play: async () => undefined,
      onError: () => undefined,
      lookahead: 0,
    });

    queue.push('anything');
    queue.end();

    // Resolves. The person's words are already safe in the conversation.
    await expect(queue.done).resolves.toBeUndefined();
  });

  it('says a reply never started, distinctly from one that stopped part-way', async () => {
    const failing: VoiceError[] = [];
    let calls = 0;
    const queue = createSpeechQueue({
      synthesize: async (text: string) => {
        calls += 1;
        // First sentence fine; everything after it fails, retry included.
        if (calls > 1) throw new Error('tts died');
        return { uri: `file:///tmp/${text}.mp3`, mimeType: 'audio/mpeg' };
      },
      play: async () => undefined,
      onError: (error) => failing.push(error),
    });

    queue.push('first');
    queue.push('second');
    queue.end();
    await queue.done;

    expect(failing).toHaveLength(1);
    expect(failing[0].kind).toBe('speakCutShort');
  });
});

describe('cancelling', () => {
  it('stops speaking anything further', async () => {
    const h = harness({ playDelayMs: 20 });

    h.queue.push('one');
    h.queue.push('two');
    h.queue.push('three');
    await new Promise((resolve) => setTimeout(resolve, 10));
    h.queue.cancel();
    await h.queue.done;

    expect(h.played.length).toBeLessThan(3);
  });

  it('ignores anything pushed after it', async () => {
    const h = harness();
    h.queue.cancel();
    h.queue.push('too late');
    await h.queue.done;

    expect(h.synthesized).toEqual([]);
  });
});

const LONG_SENTENCE =
  'Knowing whether anything formal has come from your lender changes the timeline ' +
  'and it changes which doors are still open to you at this point in the process.';

const LONG_REPLY =
  'That happens a lot, and there are real options — selling on your terms is one of them. ' +
  'Has anything formal come from your lender yet, like a notice of default? ' +
  LONG_SENTENCE +
  ' Either way, we can work out what the house would realistically bring in today.';

export type { Harness };
