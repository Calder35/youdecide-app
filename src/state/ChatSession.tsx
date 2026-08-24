import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiClient } from '../api/client';
import { sendChatMessage, type EscalationKind } from '../api/chat';
import {
  OPENING_MESSAGE,
  newStubConversation,
  stubReply,
  type StubConversation,
} from '../api/chatStub';
import { toApiError } from '../api/errors';

/**
 * The conversation, and only the conversation.
 *
 * Kept separate from `SellerSession` on purpose: discovery happens before there
 * is an account, a property, or an intent to sell anything. Coupling the two
 * would quietly turn the opening back into an intake form, which is exactly
 * what this change exists to undo.
 */

export type ChatTurnRole = 'ai' | 'you';

export type ChatTurn = {
  id: string;
  role: ChatTurnRole;
  text: string;
  /** Set on AI turns where the AI itself decided a person should come in. */
  escalate?: EscalationKind;
  escalationNote?: string;
};

export type ChatSessionValue = {
  turns: ChatTurn[];
  /** True while the AI is composing. Drives the typing indicator. */
  thinking: boolean;
  /** A send that failed, in the person's language. */
  error: string | null;
  send: (message: string) => Promise<void>;
  retry: () => Promise<void>;
  /** The highest escalation the conversation has reached, if any. */
  escalation: EscalationKind;
  escalationNote: string | null;
  /** True when talking to a real backend rather than the local stub. */
  isLive: boolean;
};

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

/** How long the stub "thinks". Long enough to read as a person-paced reply. */
const STUB_THINKING_MS = 700;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function ChatSessionProvider({
  children,
  client,
  /** Tests set this to 0 so they are not waiting on a fake typing delay. */
  thinkingDelayMs = STUB_THINKING_MS,
}: {
  children: ReactNode;
  client?: ApiClient;
  thinkingDelayMs?: number;
}) {
  const [api] = useState(() => client ?? new ApiClient());

  // The opening greeting is seeded locally in BOTH modes. The backend contract
  // takes a message and returns a reply, so there is no "start a conversation"
  // call to make — and a person should never watch a spinner before the first
  // thing the AI says to them.
  const [turns, setTurns] = useState<ChatTurn[]>([
    { id: nextId('ai'), role: 'ai', text: OPENING_MESSAGE },
  ]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const stubRef = useRef<StubConversation>(newStubConversation());
  const lastMessageRef = useRef<string | null>(null);

  const deliver = useCallback(
    async (message: string) => {
      setThinking(true);
      setError(null);

      try {
        let reply;
        if (api.isConnected) {
          reply = await sendChatMessage(api, {
            conversationId: conversationIdRef.current,
            message,
          });
          conversationIdRef.current = reply.conversationId || conversationIdRef.current;
        } else {
          const stub = stubReply(stubRef.current, message);
          stubRef.current = stub.next;
          if (thinkingDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, thinkingDelayMs));
          }
          reply = stub.reply;
        }

        // An EMPTY reply is a real thing the live backend returns — observed
        // on continuation turns against the deployed service. Rendering it
        // would put a blank bubble on screen and leave someone staring at
        // nothing, which is worse than saying the truth and offering a retry.
        if (reply.reply.trim().length === 0) {
          setError(
            'That reply came back empty — it is a problem on our side, not something you did. Try sending it again.',
          );
          return;
        }

        setTurns((current) => [
          ...current,
          {
            id: nextId('ai'),
            role: 'ai',
            text: reply.reply,
            escalate: reply.escalate,
            escalationNote: reply.escalationNote,
          },
        ]);
      } catch (thrown) {
        setError(toApiError(thrown).sellerMessage);
      } finally {
        setThinking(false);
      }
    },
    [api, thinkingDelayMs],
  );

  const send = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (trimmed.length === 0) return;

      lastMessageRef.current = trimmed;
      setTurns((current) => [...current, { id: nextId('you'), role: 'you', text: trimmed }]);
      await deliver(trimmed);
    },
    [deliver],
  );

  const retry = useCallback(async () => {
    const last = lastMessageRef.current;
    if (last === null) return;
    await deliver(last);
  }, [deliver]);

  const value = useMemo<ChatSessionValue>(() => {
    // The most serious signal the conversation has produced. Once the AI has
    // decided a person is needed, that does not silently expire a turn later.
    const rank: Record<EscalationKind, number> = {
      none: 0,
      licensed: 1,
      support: 2,
      distress: 3,
    };
    let escalation: EscalationKind = 'none';
    let escalationNote: string | null = null;
    for (const turn of turns) {
      const kind = turn.escalate ?? 'none';
      if (rank[kind] >= rank[escalation] && kind !== 'none') {
        escalation = kind;
        escalationNote = turn.escalationNote ?? escalationNote;
      }
    }

    return {
      turns,
      thinking,
      error,
      send,
      retry,
      escalation,
      escalationNote,
      isLive: api.isConnected,
    };
  }, [turns, thinking, error, send, retry, api]);

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSessionValue {
  const value = useContext(ChatSessionContext);
  if (value === null) {
    throw new Error('useChatSession must be used inside a ChatSessionProvider');
  }
  return value;
}
