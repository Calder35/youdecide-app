/**
 * Turning a byte-at-a-time text stream into whole JSON events.
 *
 * TWO WIRE FORMATS, ONE PARSER, on purpose. The backend has not settled on
 * server-sent events or newline-delimited JSON yet, and the difference between
 * them is four characters of prefix:
 *
 *   SSE      data: {"type":"sentence","text":"…"}\n\n
 *   NDJSON   {"type":"sentence","text":"…"}\n
 *
 * Committing to one now would mean a change here, a change to the tests, and a
 * conversation about who blinks first if the backend picks the other. Reading
 * both costs one `startsWith` and removes the decision from the critical path.
 * When the contract lands, this file very likely does not change at all.
 *
 * WHAT IT HAS TO GET RIGHT: a chunk boundary can fall ANYWHERE. The network
 * decides where a packet ends, not the sender, so a single event can arrive as
 * `{"type":"sen` then `tence","text":"hi"}\n`. Everything up to the last
 * newline is parsed; the remainder is held until more arrives. Getting this
 * wrong looks like an endpoint that mangles every second sentence.
 */

/** One decoded event, plus the raw line in case a caller wants to log it. */
export type StreamEvent = {
  data: Record<string, unknown>;
  raw: string;
};

export type EventStreamParser = {
  /** Feeds new text in and returns whatever events completed. */
  push: (text: string) => StreamEvent[];
  /**
   * Flushes a trailing line with no newline after it.
   *
   * A well-behaved sender ends with a newline; not every sender is well
   * behaved, and dropping the last event of a reply because of a missing `\n`
   * would mean losing the `done` event that carries the escalation.
   */
  end: () => StreamEvent[];
};

/** Lines that carry no event: SSE comments, retry hints, blank separators. */
function isNoise(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  // SSE comment / keep-alive. Proxies and servers send these to hold the
  // connection open, and they are not data.
  if (trimmed.startsWith(':')) return true;
  // SSE fields other than `data:` — `event:`, `id:`, `retry:`. The type is
  // carried inside the JSON payload, so none of them are load-bearing here.
  return /^(event|id|retry)\s*:/.test(trimmed);
}

/** Strips an SSE `data:` prefix if there is one. NDJSON passes straight through. */
function payloadOf(line: string): string {
  const trimmed = line.trim();
  return trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
}

export function createEventStreamParser(options: {
  /** Called for a line that should have been JSON and was not. */
  onUnparseable?: (line: string, error: unknown) => void;
} = {}): EventStreamParser {
  let pending = '';

  const consume = (line: string, into: StreamEvent[]) => {
    if (isNoise(line)) return;
    const payload = payloadOf(line);
    if (payload.length === 0) return;
    // The conventional end-of-stream sentinel. Not an event.
    if (payload === '[DONE]') return;

    try {
      const parsed: unknown = JSON.parse(payload);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        options.onUnparseable?.(line, new Error('event was not a JSON object'));
        return;
      }
      into.push({ data: parsed as Record<string, unknown>, raw: line });
    } catch (thrown) {
      // One bad line is not a reason to abandon a reply that is otherwise
      // arriving fine. It is reported and skipped.
      options.onUnparseable?.(line, thrown);
    }
  };

  return {
    push(text: string): StreamEvent[] {
      pending += text;
      const events: StreamEvent[] = [];

      // Split on the last newline. `\r\n` is handled by trimming each line.
      let newline = pending.indexOf('\n');
      while (newline !== -1) {
        consume(pending.slice(0, newline), events);
        pending = pending.slice(newline + 1);
        newline = pending.indexOf('\n');
      }

      return events;
    },

    end(): StreamEvent[] {
      const events: StreamEvent[] = [];
      if (pending.length > 0) {
        consume(pending, events);
        pending = '';
      }
      return events;
    },
  };
}
