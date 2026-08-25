import type { ApiClient } from './client';
import { normalizeEscalation, readEscalationNote, type ChatMode, type ChatReply } from './chat';
import { createEventStreamParser } from './eventStream';
import { openStream, pickStreamTransport } from './streamTransport';
import type { StreamHandle } from './streamRequest';
import { OFFLINE_ERROR, toApiError } from './errors';

/**
 * The conversation, delivered a sentence at a time.
 *
 * ─── THE CONTRACT, now confirmed against the live endpoint ──────────────────
 *
 *   POST /v1/chat/stream   { message, conversation_id?, mode: "voice" }
 *   → text/event-stream, one JSON object per `data:` line, one `type` each:
 *
 *     {"type":"start","conversation_id":"…"}                 always first
 *     {"type":"sentence","seq":0,"text":"…"}                 zero or more
 *     {"type":"done","conversation_id":"…","reply":"…full…",
 *      "escalate":false,"escalate_kind":"none"}              always last
 *     {"type":"error","code":"…","message":"…"}              instead of done
 *
 * A `sentence` IS ALREADY SAFE TO SPEAK when it arrives — the backend splits on
 * sentence boundaries, so nothing here waits or reassembles. That is the entire
 * point: sentence 0 is synthesised while sentence 1 is still being written.
 *
 * `done` carries the FULL reply text, so the transcript is never a reassembly
 * of what we happened to receive. If a sentence event were ever lost, the
 * written conversation still shows what the model actually said.
 *
 * ERRORS COME IN TWO KINDS, and the difference matters:
 *
 *   Before the stream starts   ordinary HTTP — 404 unknown conversation,
 *                              403 not yours, 422 unknown mode.
 *   After it starts            an `error` EVENT, because the headers have
 *                              already gone out and there is no 503 left to
 *                              send. Anything already spoken has been spoken;
 *                              it is kept, and the conversation carries on.
 *
 * WHY VOICE ONLY. Typed chat keeps `/v1/chat`. Streaming buys
 * time-to-first-SOUND, and there is no equivalent win for text: a reply that
 * paints in on screen sentence by sentence is a different design decision with
 * its own consequences for how the transcript reads.
 */

export const CHAT_STREAM_PATH = '/v1/chat/stream';

/**
 * Whether spoken turns use the stream.
 *
 * ON. The endpoint is live and the contract is confirmed. Set
 * `EXPO_PUBLIC_VOICE_STREAMING=false` to fall back to one `/v1/chat` call and
 * chunked speech — worth having as a switch, because it is the difference
 * between "voice is slow" and "voice is broken" if the stream ever misbehaves.
 */
export const VOICE_STREAMING_ENABLED =
  (process.env.EXPO_PUBLIC_VOICE_STREAMING ?? 'true').trim().toLowerCase() !== 'false';

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
  /**
   * Set when the backend reported a failure AFTER it had already sent some of
   * the reply. Those sentences were spoken; this is what to say about the rest.
   */
  cutShort: string | null;
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

/** The conversation id from a `start` event, which always arrives first. */
export function readStart(data: Record<string, unknown>): string | null {
  const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
  if (type !== 'start') return null;
  const id = data.conversation_id ?? data.conversationId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** The sentence's position in the reply, when the backend numbers them. */
export function readSeq(data: Record<string, unknown>): number | null {
  return typeof data.seq === 'number' && Number.isFinite(data.seq) ? data.seq : null;
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
  let startedConversationId: string | null = null;
  let expectedSeq = 0;
  let handle: StreamHandle | null = null;
  const transport = pickStreamTransport();

  const parser = createEventStreamParser({
    onUnparseable: (line, error) =>
      handlers.log?.(`chat stream: skipped an unreadable line — ${String(error)}: ${line.slice(0, 120)}`),
  });

  const result = new Promise<ChatStreamResult>((resolve, reject) => {
    const consume = (events: ReturnType<typeof parser.push>) => {
      for (const event of events) {
        // `start` arrives before any words and carries the conversation id, so
        // a turn that fails part-way still knows which conversation it was in.
        const started = readStart(event.data);
        if (started !== null) {
          startedConversationId = started;
          continue;
        }

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
          // Sentences are documented as in-order, and this does not reorder
          // them — speaking out of order is worse than speaking a gap. It is
          // logged, because a gap in `seq` is the backend telling us something.
          const seq = readSeq(event.data);
          if (seq !== null && seq !== expectedSeq) {
            handlers.log?.(`chat stream: expected sentence ${expectedSeq}, got ${seq}`);
          }
          expectedSeq = (seq ?? expectedSeq) + 1;

          sentences.push(sentence);
          // Straight through, the moment it lands. Nothing is buffered here.
          handlers.onSentence(sentence);
          continue;
        }

        handlers.log?.(`chat stream: ignored an event it did not recognise — ${event.raw.slice(0, 120)}`);
      }
    };

    handlers.log?.(`chat stream: opening via ${transport}`);
    handle = openStream(
      {
        url: `${client.baseUrl}${CHAT_STREAM_PATH}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body,
      },
      {
        onChunk: (text) => consume(parser.push(text)),
        onDone: () => {
          consume(parser.end());

          const done: Record<string, unknown> = doneData ?? {};
          const rawKind = done.escalate_kind ?? done.escalationKind;
          const doneId = done.conversation_id ?? done.conversationId;
          const conversationId =
            typeof doneId === 'string' && doneId.length > 0 ? doneId : (startedConversationId ?? '');

          // `done` carries the FULL reply, so the transcript is what the model
          // actually said rather than a reassembly of what happened to arrive.
          // Falling back to the sentences matters only when `done` never came.
          const fullReply = typeof done.reply === 'string' ? done.reply : '';
          const reply = fullReply.trim().length > 0 ? fullReply.trim() : sentences.join(' ').trim();

          if (streamError !== null) {
            // A FAILURE AFTER THE HEADERS WENT OUT. If sentences were already
            // spoken, they were spoken — binning them would be a worse lie than
            // an incomplete answer, and the person heard them either way. The
            // turn resolves with what there is and the conversation carries on;
            // only a stream that produced nothing at all is a failure.
            if (sentences.length === 0) {
              reject(toApiError(new Error(streamError)));
              return;
            }
            handlers.log?.(`chat stream: ended early — ${streamError}`);
          }

          resolve({
            conversationId,
            reply,
            escalate:
              rawKind !== undefined && rawKind !== null
                ? normalizeEscalation(rawKind)
                : normalizeEscalation(done.escalate),
            escalationNote: readEscalationNote(
              done.escalate,
              typeof done.escalation_note === 'string' ? done.escalation_note : undefined,
            ),
            endedWithoutDone: doneData === null,
            cutShort: streamError,
          });
        },
        onError: (error) => reject(toApiError(error)),
      },
    );
  });

  return { result, cancel: () => handle?.cancel() };
}
