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

/** Below this, a trailing fragment is merged backwards instead of left alone. */
const MIN_TRAILING_CHARS = 40;

/**
 * Splits text into chunks at sentence boundaries, never mid-word.
 *
 * Returns a single chunk for short text, so an ordinary reply is unaffected.
 */
export function splitForSpeech(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  const cleaned = text.trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of splitIntoSentences(cleaned)) {
    // A single sentence longer than the budget gets broken on word boundaries;
    // running past the limit would defeat the point.
    const pieces = sentence.length > maxChars ? breakOnWords(sentence, maxChars) : [sentence];

    for (const piece of pieces) {
      if (current.length === 0) {
        current = piece;
      } else if (current.length + 1 + piece.length <= maxChars) {
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
  // undo a split that was made for a reason.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    const previous = chunks[chunks.length - 2];
    if (last.length < MIN_TRAILING_CHARS && previous.length + 1 + last.length <= maxChars) {
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

/** Last resort for a sentence with no usable boundary inside the budget. */
function breakOnWords(sentence: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let current = '';

  for (const word of sentence.split(/\s+/)) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      pieces.push(current);
      current = word;
    }
  }

  if (current.length > 0) pieces.push(current);
  return pieces;
}
