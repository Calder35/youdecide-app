import type { ApiClient } from './client';
import { CHAT_TIMEOUT_MS } from './config';

/**
 * The conversation with You Decide AI.
 *
 * Backend contract (POST /v1/chat):
 *
 *   request   { conversation_id?: string, message: string }
 *   response  { conversation_id: string, reply: string,
 *               escalate?: boolean, escalate_kind?: string }
 *
 * The live backend sends BOTH: `escalate` as a boolean and `escalate_kind` as
 * the reason ("none" | "distress" | …). Reading only the boolean loses the
 * distinction between "someone is having a hard time" and "someone is in
 * crisis", which is the distinction that matters most — so `escalate_kind`
 * wins whenever it is present.
 *
 * `escalate` is the ONLY thing that brings a person into the conversation.
 * There is no user-facing "talk to a human" exit — see `EscalationOffer` for
 * why. The field is read tolerantly (boolean, string, or object) because the
 * endpoint is not built yet and we would rather degrade than crash on a shape
 * we did not predict.
 */

/** How a person gets brought in, when the AI decides one is needed. */
export type EscalationKind =
  /** Nobody needed. The overwhelming majority of turns. */
  | 'none'
  /** A hard life circumstance. Offer warmth and a person, gently. */
  | 'support'
  /** A question only a licensed Nevada agent may answer. */
  | 'licensed'
  /** Signs of crisis. Handled with care, and never as a sales moment. */
  | 'distress';

export type ChatReply = {
  conversationId: string;
  reply: string;
  escalate: EscalationKind;
  /** The AI's own words about why a person would help. Shown, if present. */
  escalationNote?: string;
};

type RawChatResponse = {
  conversation_id?: string;
  conversationId?: string;
  reply?: string;
  escalate?: unknown;
  escalate_kind?: unknown;
  escalationKind?: unknown;
  escalation_note?: string;
  escalationNote?: string;
};

const KINDS: EscalationKind[] = ['none', 'support', 'licensed', 'distress'];

/**
 * Read whatever the backend sent into a kind we can render.
 *
 * Tolerant on purpose: `true`, `"support"`, `{ kind: "distress" }` and
 * `{ reason: ... }` all mean something a person should act on. An unrecognised
 * value becomes `support` rather than `none` — if the backend is trying to tell
 * us something and we cannot parse it, the safe failure is to offer help, not
 * to swallow the signal.
 */
export function normalizeEscalation(raw: unknown): EscalationKind {
  if (raw === undefined || raw === null || raw === false || raw === 'none') return 'none';
  if (raw === true) return 'support';

  if (typeof raw === 'string') {
    const value = raw.toLowerCase().trim();
    return (KINDS as string[]).includes(value) ? (value as EscalationKind) : 'support';
  }

  if (typeof raw === 'object') {
    const record = raw as { kind?: unknown; type?: unknown; level?: unknown };
    const nested = record.kind ?? record.type ?? record.level;
    if (nested !== undefined) return normalizeEscalation(nested);
    return 'support';
  }

  return 'support';
}

export function readEscalationNote(raw: unknown, fallback?: string): string | undefined {
  if (typeof raw === 'object' && raw !== null) {
    const record = raw as { reason?: unknown; note?: unknown };
    const note = record.reason ?? record.note;
    if (typeof note === 'string' && note.trim().length > 0) return note.trim();
  }
  return fallback !== undefined && fallback.trim().length > 0 ? fallback.trim() : undefined;
}

export async function sendChatMessage(
  client: ApiClient,
  input: { conversationId: string | null; message: string },
): Promise<ChatReply> {
  const body: { message: string; conversation_id?: string } = { message: input.message };
  if (input.conversationId !== null) {
    body.conversation_id = input.conversationId;
  }

  const raw = await client.request<RawChatResponse>({
    method: 'POST',
    path: '/v1/chat',
    body,
    timeoutMs: CHAT_TIMEOUT_MS,
    // The conversation is not tied to a seller account — discovery happens
    // before there is any account to tie it to. That is the point.
  });

  // `escalate_kind` is the specific signal; `escalate` is the boolean beside
  // it. Prefer the kind, fall back to the boolean.
  const rawKind = raw.escalate_kind ?? raw.escalationKind;
  const escalate =
    rawKind !== undefined && rawKind !== null
      ? normalizeEscalation(rawKind)
      : normalizeEscalation(raw.escalate);

  return {
    conversationId: raw.conversation_id ?? raw.conversationId ?? '',
    reply: raw.reply ?? '',
    escalate,
    escalationNote: readEscalationNote(raw.escalate, raw.escalation_note ?? raw.escalationNote),
  };
}
