import type { ApiClient } from './client';
import { normalizeEscalation, readEscalationNote, type ChatMode, type ChatReply } from './chat';
import { createEventStreamParser } from './eventStream';
import { streamRequest, type StreamHandle } from './streamRequest';
import { OFFLINE_ERROR, toApiError } from './errors';

/**
 * The conversation, delivered a sentence at a time.
 *
 * ─── THIS FILE IS THE SEAM ──────────────────────────────────────────────────
 *
 * The backend's streaming endpoint is being built as this lands, and the exact
 * path and event shapes are not final. EVERYTHING WE ARE GUESSING ABOUT IS IN
 * THIS FILE — the transport under it (`streamRequest`) and the parser beside it
 * (`eventStream`) know nothing about chat, and the speech queue above it knows
 * nothing about HTTP. When the contract arrives, the change is `CHAT_STREAM_PATH`
 * and the field names in `readSentence` / `readDone`, and nothing else moves.
 *
 * WHAT IT IS BUILT AGAINST, until told otherwise:
 *
 *   POST /v1/chat/stream   { conversation_id?, message, mode: "voice" }
 *
 *   → {"type":"sentence","text":"That happens a lot."}
 *     {"type":"sentence","text":"Has anything come from your lender?"}
 *     {"type":"done","conversation_id":"…","escalate":false,"escalate_kind":"none"}
 *
 * as either SSE or newline-delimited JSON — the parser reads both.
 *
 * IT IS DELIBERATELY TOLERANT about field names, the same way `chat.ts` is
 * about escalation. `text`/`sentence`/`delta` all mean the same thing to a
 * person, and a stream that half-works because one key was spelled differently
 * is a bad afternoon. Anything genuinely unrecognised is logged, not guessed at.
 *
 * WHY VOICE ONLY. Typed chat keeps using the plain `/v1/chat`. Streaming buys
 * time-to-first-SOUND, and there is no equivalent win for text: a reply that
 * paints in sentence by sentence on screen is a different design decision, with
 * its own consequences for how the transcript reads, and it is not this one.
 */

/**
 * Where the stream lives. One line to change when the backend confirms it.
 */
export const CHAT_STREAM_PATH = '/v1/chat/stream';

/**
 * Whether spoken turns use the stream.
 *
 * OFF until the contract is confirmed against the real endpoint. With this
 * false the app behaves exactly as it does today — one `/v1/chat` call, then
 * chunked speech — so this can sit on main safely while the backend is built.
 */
export const VOICE_STREAMING_ENABLED =
  (process.env.EXPO_PUBLIC_VOICE_STREAMING ?? '').trim().toLowerCase() === 'true';

export type ChatStreamHandlers = {
  /**
   * A whole sentence, ready to be spoken. Called in order, as each arrives.
   *
   * This is the callback the entire feature exists for: it fires while the rest
   * of the reply is still being written, so synthesis of sentence one overlaps
   * the generation of sentence two.
   */
  onSentence: (sentence: string) => void;
  /** Diagnostics — unrecognised events, and the shape of what did arrive. */
  log?: (message: string) => void;
};

export type ChatStreamResult = ChatReply & {
  /** True when the stream ended without ever sending a `done` event. */
  endedWithoutDone: boolean;
};

/** Reads a sentence out of an event, whatever the backend decided to call it. */
export function readSentence(data: Record<string, unknown>): string | null {
  const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
  if (type !== '' && type !== 'sentence' && type !== 'delta' && type !== 'text') return null;

  const value = data.text ?? data.sentence ?? data.delta ?? data.content;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True when this event says the reply is complete. */
export function isDone(data: Record<string, unknown>): boolean {
  const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
  return type === 'done' || type === 'end' || type === 'complete';
}

/** True when the backend is reporting a failure mid-stream rather than data. */
export function readStreamError(data: Record<string, unknown>): string | null {
  const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
  if (type !== 'error') return null;
  const message = data.message ?? data.detail ?? data.error;
  return typeof message === 'string' ? message : 'the reply failed part-way through';
}

/**
 * Streams one spoken turn.
 *
 * Resolves with the assembled reply and the escalation from the `done` event —
 * the same shape `sendChatMessage` returns, so everything downstream of it is
 * unchanged.
 */
export function streamChatMessage(
  client: ApiClient,
  input: { conversationId: string | null; message: string; mode?: ChatMode },
  handlers: ChatStreamHandlers,
): { result: Promise<ChatStreamResult>; cancel: () => void } {
  if (!client.isConnected) {
    return { result: Promise.reject(OFFLINE_ERROR()), cancel: () => undefined };
  }

  const body: { message: string; conversation_id?: string; mode?: ChatMode } = {
    message: input.message,
  };
  if (input.conversationId !== null) body.conversation_id = input.conversationId;
  if (input.mode !== undefined) body.mode = input.mode;

  const sentences: string[] = [];
  let doneData: Record<string, unknown> | null = null;
  let streamError: string | null = null;
  let handle: StreamHandle | null = null;

  const parser = createEventStreamParser({
    onUnparseable: (line, error) =>
      handlers.log?.(`chat stream: skipped an unreadable line — ${String(error)}: ${line.slice(0, 120)}`),
  });

  const result = new Promise<ChatStreamResult>((resolve, reject) => {
    const consume = (events: ReturnType<typeof parser.push>) => {
      for (const event of events) {
        const failure = readStreamError(event.data);
        if (failure !== null) {
          streamError = failure;
          continue;
        }

        if (isDone(event.data)) {
          doneData = event.data;
          continue;
        }

        const sentence = readSentence(event.data);
        if (sentence !== null) {
          sentences.push(sentence);
          // Straight through, the moment it lands. Nothing is buffered here.
          handlers.onSentence(sentence);
          continue;
        }

        handlers.log?.(`chat stream: ignored an event it did not recognise — ${event.raw.slice(0, 120)}`);
      }
    };

    handle = streamRequest(
      {
        url: `${client.baseUrl}${CHAT_STREAM_PATH}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Says we can read either wire format. The server picks.
          Accept: 'text/event-stream, application/x-ndjson',
        },
        body,
      },
      {
        onChunk: (text) => consume(parser.push(text)),
        onDone: () => {
          consume(parser.end());

          if (streamError !== null) {
            reject(toApiError(new Error(streamError)));
            return;
          }

          const done: Record<string, unknown> = doneData ?? {};
          const rawKind = done.escalate_kind ?? done.escalationKind;
          const escalate =
            rawKind !== undefined && rawKind !== null
              ? normalizeEscalation(rawKind)
              : normalizeEscalation(done.escalate);

          const conversationId = done.conversation_id ?? done.conversationId;

          resolve({
            conversationId: typeof conversationId === 'string' ? conversationId : '',
            // Sentences are rejoined with a space: they arrived as separate
            // units of speech, and the transcript wants one paragraph.
            reply: sentences.join(' ').trim(),
            escalate,
            escalationNote: readEscalationNote(
              done.escalate,
              typeof done.escalation_note === 'string' ? done.escalation_note : undefined,
            ),
            endedWithoutDone: doneData === null,
          });
        },
        onError: (error) => reject(toApiError(error)),
      },
    );
  });

  return { result, cancel: () => handle?.cancel() };
}
