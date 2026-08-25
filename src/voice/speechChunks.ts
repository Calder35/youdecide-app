/**
 * Splitting a reply into speakable pieces.
 *
 * WHY THIS EXISTS. Synthesising a whole reply in one call scales badly in three
 * directions at once. Measured against the live service:
 *
 *     900 chars →  9.4s →  0.95 MB
 *   1,230 chars → 13.1s →  1.33 MB
 *   2,000 chars → 22.3s →  2.40 MB
 *   3,500 chars → 37.7s →  4.05 MB
 *
 * So a long reply means a long silence before ANY sound, a large file to write
 * and load, and a single call with everything riding on it. Speaking a reply
 * sentence by sentence turns all three around: the first sound arrives in about
 * a second, every file is small, and one failed chunk costs a sentence rather
 * than the whole answer.
 *
 * It also sounds better. A model reply is written to be read — paragraphs, long
 * clauses — and chunking at sentence boundaries gives the delivery natural
 * places to breathe.
 */

/**
 * Target size for one spoken chunk.
 *
 * Roughly a long sentence or two: short enough that the first one is quick,
 * long enough that the seams fall at real pauses rather than mid-thought.
 */
export const MAX_CHUNK_CHARS = 240;

/**
 * A TIGHTER budget for the FIRST chunk only, because that one is the wait.
 *
 * Timed against the live `/v1/voice/speak`, synthesis is a fixed cost plus a
 * per-character one — about 1.25s + 5ms/char:
 *
 *      8 chars → 1.47s      160 chars → 1.99s
 *     40 chars → 1.29s      245 chars → 2.51s
 *     88 chars → 1.45s
 *
 * A spoken-mode reply runs 150-180 characters, which fitted inside the old
 * 240-character budget as a SINGLE chunk — so chunking, built to help long
 * replies, did nothing at all for the ordinary case and every turn paid the
 * full two seconds. Cutting the first chunk at ~110 characters lands it on the
 * first sentence and starts the sound roughly half a second sooner, every turn.
 *
 * Not smaller: the fixed 1.25s dominates below about 60 characters, so a
 * shorter opener buys almost nothing and costs a seam in the middle of a
 * thought.
 */
export const FIRST_CHUNK_CHARS = 110;

/** Below this, a trailing fragment is merged backwards instead of left alone. */
const MIN_TRAILING_CHARS = 40;

/**
 * Splits text into chunks at sentence boundaries, never mid-word.
 *
 * Returns a single chunk for short text, so an ordinary reply is unaffected.
 */
export function splitForSpeech(
  text: string,
  maxChars: number = MAX_CHUNK_CHARS,
  firstMaxChars: number = Math.min(FIRST_CHUNK_CHARS, maxChars),
): string[] {
  const cleaned = text.trim();
  if (cleaned.length === 0) return [];
  // Short enough to say in one go and still start quickly. Splitting here would
  // add a seam and save nothing.
  if (cleaned.length <= firstMaxChars) return [cleaned];

  const chunks: string[] = [];
  let current = '';

  /** The first chunk gets the tight budget; everything after it the normal one. */
  const budget = () => (chunks.length === 0 ? firstMaxChars : maxChars);

  for (const sentence of splitIntoSentences(cleaned)) {
    // A single sentence longer than the budget gets broken on word boundaries;
    // running past the limit would defeat the point.
    const pieces =
      sentence.length > budget() ? breakOnWords(sentence, budget(), maxChars) : [sentence];

    for (const piece of pieces) {
      if (current.length === 0) {
        current = piece;
      } else if (current.length + 1 + piece.length <= budget()) {
        current = `${current} ${piece}`;
      } else {
        chunks.push(current);
        current = piece;
      }
    }
  }

  if (current.length > 0) chunks.push(current);

  // A stray "Yes." on its own sounds like an afterthought; glue it to the
  // sentence it belongs with — but never past the budget, or the merge would
  // undo a split that was made for a reason. Merging back into the FIRST chunk
  // has to respect the tighter opening budget, since that is the one protecting
  // time-to-first-sound.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    const previous = chunks[chunks.length - 2];
    const limit = chunks.length === 2 ? firstMaxChars : maxChars;
    if (last.length < MIN_TRAILING_CHARS && previous.length + 1 + last.length <= limit) {
      chunks.pop();
      chunks[chunks.length - 1] = `${previous} ${last}`;
    }
  }

  return chunks;
}

/**
 * Sentence boundaries, and paragraph breaks.
 *
 * Deliberately simple. It splits after `.`/`!`/`?` followed by whitespace, and
 * at blank lines. It will occasionally split an abbreviation — "Ave." — and
 * that costs a slightly early pause, which is a much smaller problem than the
 * regex needed to avoid it.
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * Last resort for a sentence with no usable boundary inside the budget.
 *
 * The first piece may have a tighter budget than the rest — a run-on sentence
 * at the very start of a reply still gets a quick opening piece.
 */
function breakOnWords(sentence: string, firstMaxChars: number, maxChars: number): string[] {
  const pieces: string[] = [];
  let current = '';

  for (const word of sentence.split(/\s+/)) {
    const budget = pieces.length === 0 ? firstMaxChars : maxChars;
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= budget) {
      current = `${current} ${word}`;
    } else {
      pieces.push(current);
      current = word;
    }
  }

  if (current.length > 0) pieces.push(current);
  return pieces;
}
