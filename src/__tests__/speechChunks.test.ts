import { MAX_CHUNK_CHARS, splitForSpeech } from '../voice/speechChunks';

/**
 * Splitting a reply for speech.
 *
 * The measured problem: synthesising a whole reply in one call took 9.4s at 900
 * characters and 37.7s at 3,500 — all of it silence before any sound, and a
 * multi-megabyte file at the end of it. Chunking trades one long wait for a
 * short one, and gives a long reply somewhere natural to breathe.
 */

/** A real-shaped discovery reply: paragraphs, long clauses, em-dashes. */
const LONG_REPLY = `I'm really glad you told me that — being behind on the mortgage is a heavy thing to carry, and it's the kind of thing people sit on for months before saying out loud.

Before we talk about the house at all, I want to understand where you actually are. How far behind are you, and has the lender been in touch, or is this still something you're holding on your own?

There's usually more room than people think. The options are very different depending on whether you're one month behind or six, and nothing you tell me commits you to anything at all.`;

describe('short replies are left alone', () => {
  it('returns one chunk for an ordinary answer', () => {
    expect(splitForSpeech('Tell me more about that.')).toEqual(['Tell me more about that.']);
  });

  it('returns nothing for nothing', () => {
    expect(splitForSpeech('')).toEqual([]);
    expect(splitForSpeech('   \n  ')).toEqual([]);
  });
});

describe('long replies are split for speech', () => {
  const chunks = splitForSpeech(LONG_REPLY);

  it('produces several chunks', () => {
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('keeps every chunk within the budget', () => {
    const tooLong = chunks.filter((chunk) => chunk.length > MAX_CHUNK_CHARS);
    expect(tooLong).toEqual([]);
  });

  it('loses none of the words', () => {
    const original = LONG_REPLY.replace(/\s+/g, ' ').trim();
    expect(chunks.join(' ')).toBe(original);
  });

  it('breaks at sentence ends, not mid-thought', () => {
    // Every chunk but the last should finish a sentence.
    const midSentence = chunks.slice(0, -1).filter((chunk) => !/[.!?]$/.test(chunk));
    expect(midSentence).toEqual([]);
  });

  it('never splits a word', () => {
    for (const chunk of chunks) {
      expect(`"${chunk}"`).toBe(`"${chunk.trim()}"`);
      expect(chunk).not.toMatch(/\s{2,}/);
    }
  });

  it('gets the first sound going quickly', () => {
    // The whole point: the first chunk is short enough to synthesise fast.
    expect(chunks[0].length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });
});

describe('awkward input still splits sanely', () => {
  it('breaks a single enormous sentence on word boundaries', () => {
    const runOn = `${'word '.repeat(200)}end.`;
    const chunks = splitForSpeech(runOn);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.filter((chunk) => chunk.length > MAX_CHUNK_CHARS)).toEqual([]);
    expect(chunks.join(' ')).toBe(runOn.replace(/\s+/g, ' ').trim());
  });

  it('handles text with no punctuation at all', () => {
    const chunks = splitForSpeech('a'.repeat(50) + ' ' + 'b'.repeat(50) + ' ' + 'c'.repeat(400));
    expect(chunks.filter((chunk) => chunk.length > MAX_CHUNK_CHARS).length).toBeLessThanOrEqual(1);
  });

  it('does not leave a stray fragment on its own at the end', () => {
    const text = `${'This is a full sentence that runs on for a while. '.repeat(6)}Yes.`;
    const chunks = splitForSpeech(text);
    // "Yes." is glued to the sentence before it rather than spoken alone.
    expect(chunks[chunks.length - 1]).toMatch(/\. Yes\.$/);
  });

  it('treats a paragraph break as a boundary', () => {
    const chunks = splitForSpeech('First thought here.\n\nSecond thought here.', 30);
    expect(chunks).toEqual(['First thought here.', 'Second thought here.']);
  });
});
