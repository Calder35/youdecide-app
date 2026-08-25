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
import { sendChatMessage, type ChatMode, type EscalationKind } from '../api/chat';
import { VOICE_STREAMING_ENABLED, streamChatMessage } from '../api/chatStream';
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
  /**
   * Resolves with the AI's reply text, or null if there was not one.
   *
   * `mode: 'voice'` marks a spoken turn so the backend can answer in a couple
   * of sentences rather than paragraphs. Typed turns pass nothing.
   */
  send: (message: string, options?: { mode?: ChatMode }) => Promise<string | null>;
  /**
   * True when a turn can be streamed sentence by sentence.
   *
   * False until the streaming endpoint is confirmed, and false with no backend.
   * Callers check this rather than catching a failure, because a spoken turn
   * that fails over to the plain endpoint would ask the same question twice.
   */
  streamingAvailable: boolean;
  /**
   * Sends a turn and reports each sentence AS IT IS WRITTEN.
   *
   * Only voice uses this. `onSentence` fires while the rest of the reply is
   * still being generated, which is what lets speech start early; the
   * transcript still gains one AI turn at the end, with the whole reply and its
   * escalation, exactly as a non-streamed turn does.
   */
  sendStreaming: (
    message: string,
    options: { mode?: ChatMode; onSentence: (sentence: string) => void },
  ) => Promise<string | null>;
  retry: () => Promise<string | null>;
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
  /**
   * Whether spoken turns stream. Defaults to the build flag.
   *
   * A prop as well as a flag because both paths are real and both have to stay
   * tested: streaming is what ships, and the plain `/v1/chat` path is what a
   * turn falls back to if the stream is ever switched off.
   */
  streaming = VOICE_STREAMING_ENABLED,
}: {
  children: ReactNode;
  client?: ApiClient;
  thinkingDelayMs?: number;
  streaming?: boolean;
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
  // Retry has to resend the SAME kind of turn. Retrying a spoken message as a
  // typed one would hand back a paragraph to something waiting to speak it.
  const lastSendRef = useRef<{ message: string; mode?: ChatMode } | null>(null);

  const deliver = useCallback(
    async (message: string, mode?: ChatMode): Promise<string | null> => {
      setThinking(true);
      setError(null);

      try {
        let reply;
        if (api.isConnected) {
          reply = await sendChatMessage(api, {
            conversationId: conversationIdRef.current,
            message,
            mode,
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
          return null;
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

        return reply.reply;
      } catch (thrown) {
        setError(toApiError(thrown).sellerMessage);
        return null;
      } finally {
        setThinking(false);
      }
    },
    [api, thinkingDelayMs],
  );

  const send = useCallback(
    async (message: string, options?: { mode?: ChatMode }): Promise<string | null> => {
      const trimmed = message.trim();
      if (trimmed.length === 0) return null;

      lastSendRef.current = { message: trimmed, mode: options?.mode };
      setTurns((current) => [...current, { id: nextId('you'), role: 'you', text: trimmed }]);
      return deliver(trimmed, options?.mode);
    },
    [deliver],
  );

  const streamingAvailable = api.isConnected && streaming;

  const sendStreaming = useCallback(
    async (
      message: string,
      options: { mode?: ChatMode; onSentence: (sentence: string) => void },
    ): Promise<string | null> => {
      const trimmed = message.trim();
      if (trimmed.length === 0) return null;

      lastSendRef.current = { message: trimmed, mode: options.mode };
      setTurns((current) => [...current, { id: nextId('you'), role: 'you', text: trimmed }]);
      setThinking(true);
      setError(null);

      try {
        const { result } = streamChatMessage(
          api,
          { conversationId: conversationIdRef.current, message: trimmed, mode: options.mode },
          { onSentence: options.onSentence },
        );
        const reply = await result;
        conversationIdRef.current = reply.conversationId || conversationIdRef.current;

        // Same judgement as the non-streamed path: a blank reply is a real
        // thing this backend returns, and a blank bubble is worse than saying so.
        if (reply.reply.trim().length === 0) {
          setError(
            'That reply came back empty — it is a problem on our side, not something you did. Try sending it again.',
          );
          return null;
        }

        // ONE turn at the end, carrying the whole reply. The sentences went to
        // the speaker as they arrived; the transcript is not a teleprompter,
        // and painting it in line by line is a separate design decision.
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

        // The reply stopped part-way through, after some of it had already been
        // said out loud. What there is stays — on screen and spoken — and the
        // conversation carries on; this only explains the missing end of it.
        if (reply.cutShort !== null) {
          setError(
            'That answer stopped part-way through — the part above is what came back. Ask again and I will pick it up.',
          );
        }

        return reply.reply;
      } catch (thrown) {
        setError(toApiError(thrown).sellerMessage);
        return null;
      } finally {
        setThinking(false);
      }
    },
    [api],
  );

  const retry = useCallback(async (): Promise<string | null> => {
    const last = lastSendRef.current;
    if (last === null) return null;
    return deliver(last.message, last.mode);
  }, [deliver]);

  const value = useMemo<ChatSessionValue>(() => {
    /**
     * The escalation of the LATEST AI turn — not the worst one ever seen.
     *
     * This used to be sticky: once any turn escalated, the offer stayed for the
     * rest of the conversation. That was wrong, and a live test showed exactly
     * how wrong. The backend fired `distress` on someone saying they were
     * behind on their mortgage — a hard financial situation, not a crisis — and
     * because the state was sticky, a crisis card with a suicide hotline sat
     * over the rest of that person's conversation with no way to clear it.
     *
     * A false positive should cost one turn, not the session. When the current
     * turn says `none`, the screen is a clean conversation again.
     */
    const latestAiTurn = [...turns].reverse().find((turn) => turn.role === 'ai');
    const escalation: EscalationKind = latestAiTurn?.escalate ?? 'none';
    const escalationNote = escalation === 'none' ? null : (latestAiTurn?.escalationNote ?? null);

    return {
      turns,
      thinking,
      error,
      send,
      streamingAvailable,
      sendStreaming,
      retry,
      escalation,
      escalationNote,
      isLive: api.isConnected,
    };
  }, [turns, thinking, error, send, streamingAvailable, sendStreaming, retry, api]);

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSessionValue {
  const value = useContext(ChatSessionContext);
  if (value === null) {
    throw new Error('useChatSession must be used inside a ChatSessionProvider');
  }
  return value;
}
