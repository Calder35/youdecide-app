import type { ChatReply, EscalationKind } from './chat';

/**
 * You Decide AI, running locally, until POST /v1/chat exists.
 *
 * This is a STUB, not a model. It is here so the opening experience is fully
 * demoable on a phone with no backend, and so the shape of the conversation —
 * discovery first, reflection before advice, a person only when one is truly
 * needed — is something a reviewer can feel rather than read about.
 *
 * WHAT IT WILL NOT DO, deliberately:
 *   - It never mentions the fee, listing, or any part of the sale process.
 *     The opening is about the person, not the transaction. If a seller asks
 *     directly, it says a person will walk them through it later.
 *   - It never offers "would you rather talk to a human?" as an exit. Help is
 *     offered when the conversation shows it is needed, and not before.
 *
 * Swapping in the real endpoint is one env var: set EXPO_PUBLIC_API_BASE_URL
 * and `sendChatMessage` takes over. Nothing else changes.
 */

/** The first thing a person sees. Warm, open, and about them. */
export const OPENING_MESSAGE =
  "Hi — I'm You Decide AI. Before we talk about anything to do with property, I'd like to understand what's going on for you. What's on your mind?";

export type StubConversation = {
  id: string;
  /** How many times the person has spoken. Drives the discovery arc. */
  turns: number;
};

export function newStubConversation(seed = 'local'): StubConversation {
  return { id: `stub-${seed}`, turns: 0 };
}

/**
 * Language that means someone is having a hard time, in two tiers.
 *
 * CRISIS is narrow and about harm to self. Everything in HARDSHIP is a heavy
 * life event — real, common in this business, and worth a human — but it is
 * not a crisis, and treating it as one would be its own kind of unkind.
 */
const CRISIS = [
  'kill myself',
  'killing myself',
  'end my life',
  'ending my life',
  'suicide',
  'suicidal',
  'hurt myself',
  'harm myself',
  'not want to live',
  "don't want to live",
  'want to die',
  'no reason to live',
];

const HARDSHIP = [
  'foreclosure',
  'foreclose',
  'eviction',
  'evicted',
  'divorce',
  'divorcing',
  'separated',
  'passed away',
  'died',
  'death',
  'funeral',
  'cancer',
  'illness',
  'hospice',
  'lost my job',
  'laid off',
  'unemployed',
  "can't afford",
  'cannot afford',
  'behind on payments',
  'bankruptcy',
  'overwhelmed',
  'scared',
  'terrified',
  'desperate',
  'panic',
  'no idea what to do',
];

/** Questions a licensed person has to answer, not an AI. */
const LICENSED = [
  'legally',
  'legal',
  'lawyer',
  'attorney',
  'contract',
  'sue',
  'lawsuit',
  'title',
  'lien',
  'disclosure',
  'tax',
];

function mentions(text: string, phrases: string[]): boolean {
  const haystack = text.toLowerCase();
  return phrases.some((phrase) => haystack.includes(phrase));
}

/**
 * A short piece of the person's own words, to reflect back.
 *
 * Reflection is the whole point of discovery: someone should be able to tell
 * they were actually heard, not pattern-matched. Quoting their phrasing is the
 * cheapest honest way to show that.
 */
export function echoFragment(message: string): string {
  const cleaned = message.trim().replace(/\s+/g, ' ');
  const firstClause = cleaned.split(/[.!?;]/)[0] ?? cleaned;
  const fragment = firstClause.length > 0 ? firstClause : cleaned;
  const trimmed = fragment.length > 90 ? `${fragment.slice(0, 87).trimEnd()}…` : fragment;
  return trimmed.replace(/^(i|we)\s/i, (match) => match.toLowerCase());
}

/** The discovery arc, once nothing heavier is going on. */
const DISCOVERY_TURNS: ((fragment: string) => string)[] = [
  (fragment) =>
    `Thank you for telling me that. I heard you say ${quote(fragment)} — I want to make sure I understand it properly before anything else.\n\nWhat's been driving this for you? I'm asking about your life, not the property.`,
  (fragment) =>
    `That makes sense. ${capitalize(quote(fragment))} is a real thing to be carrying.\n\nHow soon does something need to change? And is that timing yours, or is it being set by someone else?`,
  (fragment) =>
    `Got it — ${quote(fragment)}. Timing pressure changes what good options even look like, so I'm glad I asked.\n\nWhat matters most to you in how this turns out? And what are you most worried about?`,
  (fragment) =>
    `That's useful, and honestly it's the part most people don't get asked. ${capitalize(quote(fragment))} tells me a lot about what a good outcome would need to look like for you.\n\nIs there anything you'd want someone helping you to know — something that wouldn't show up on paper?`,
  () =>
    "Thank you. I've got a real picture now.\n\nHere's what I understand: you're weighing something significant, on a timeline that isn't entirely yours, and what matters to you isn't only the number at the end of it.\n\nWe don't have to decide anything today. When you're ready, I can start looking at what your actual options are — and I'll show you where every figure comes from and how confident I am in it. What would be most useful next?",
];

const CONTINUED =
  "I'm still here, and still listening. Tell me more whenever you want to — there's no rush and nothing here is a form to finish.";

function quote(fragment: string): string {
  return `“${fragment}”`;
}

function capitalize(text: string): string {
  const stripped = text.replace(/^“/, '');
  return `“${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`;
}

/**
 * The stub's reply to one message.
 *
 * Pure and synchronous so it is trivially testable; the caller adds the
 * thinking delay that makes it feel like a conversation.
 */
export function stubReply(
  conversation: StubConversation,
  message: string,
): { reply: ChatReply; next: StubConversation } {
  const next: StubConversation = { ...conversation, turns: conversation.turns + 1 };
  const fragment = echoFragment(message);

  if (mentions(message, CRISIS)) {
    return {
      next,
      reply: {
        conversationId: conversation.id,
        escalate: 'distress',
        reply:
          "I want to stop and say something directly, because it matters more than anything else we were talking about.\n\nWhat you've just told me sounds really heavy, and I don't want you to be holding it on your own. I'm not the right kind of help for this — a person is.",
        escalationNote:
          'Someone here can talk with you now, and property is not what they will want to talk about first.',
      },
    };
  }

  if (mentions(message, HARDSHIP)) {
    return {
      next,
      reply: {
        conversationId: conversation.id,
        escalate: 'support',
        reply: `I'm sorry — ${quote(fragment)} is genuinely hard, and I don't want to move past it to get to the practical part.\n\nWhat you're dealing with shapes what the right options are, so it isn't a detour. Take whatever time you need. What's weighing on you most right now?`,
        escalationNote:
          'When you want one, there is a person here who has helped people through exactly this.',
      },
    };
  }

  if (mentions(message, LICENSED)) {
    return {
      next,
      reply: {
        conversationId: conversation.id,
        escalate: 'licensed',
        reply:
          "That's a question I shouldn't answer on my own — it's the kind that needs someone licensed, because getting it wrong would cost you.\n\nI can tell you what I do understand about your situation so far, and make sure the right person picks it up with the full picture rather than from scratch.",
        escalationNote: 'A licensed Nevada agent should be the one to answer this.',
      },
    };
  }

  const index = Math.min(conversation.turns, DISCOVERY_TURNS.length - 1);
  const isLast = conversation.turns >= DISCOVERY_TURNS.length;
  const reply = isLast ? CONTINUED : DISCOVERY_TURNS[index](fragment);

  return {
    next,
    reply: { conversationId: conversation.id, reply, escalate: 'none' as EscalationKind },
  };
}
