import type { ConsentDefinition, ConsentState } from './types';

/**
 * Three separate consents, each recorded on its own.
 *
 * Not one blanket "I agree to everything" box: the seller can decline contact
 * and still use the app, and each agreement is written in the same plain
 * language as the rest of the flow. Chunk 4 posts each one as its own audited
 * event, which is why they are modeled separately from the start.
 */
export const CONSENTS: readonly ConsentDefinition[] = [
  {
    id: 'terms',
    title: 'Terms of service and electronic signature',
    body: 'You agree to use the app under our terms, and to sign documents electronically. You can ask for paper instead at any point.',
    why: 'Selling a home means signing things. Agreeing once, up front, means you are not asked again at every document.',
    ifDeclined: 'We cannot prepare paperwork for you, so the listing work cannot start. You can still look around the app.',
    required: true,
  },
  {
    id: 'dataUse',
    title: 'Using your information to prepare your listing',
    body: 'We use what you tell us and public property records to prepare your listing, pricing work, and paperwork. We do not sell your information.',
    why: 'The pricing work, the prep list, and the disclosures are all built from your answers and your property record. Without this there is nothing to build them from.',
    ifDeclined: 'We cannot open a property workspace or draft a plan. Nothing else changes, and you can withdraw this later.',
    required: true,
  },
  {
    id: 'contact',
    title: 'Letting a licensed agent contact you',
    body: 'A licensed Nevada agent may call or text you about your sale. Decline and you can still use the app — you would reach out to us instead.',
    why: 'Some things are faster in a two-minute call than in a week of messages. This lets an agent start that call.',
    ifDeclined: 'Nothing is taken away. No one calls or texts you, and you reach out through “Get a human” whenever you want to.',
    required: false,
  },
];

export const EMPTY_CONSENTS: ConsentState = {
  terms: false,
  dataUse: false,
  contact: false,
};

/** Required consents, and only those, gate moving forward. */
export function requiredConsentsGiven(state: ConsentState): boolean {
  return CONSENTS.filter((consent) => consent.required).every((consent) => state[consent.id]);
}

export function missingRequiredConsents(state: ConsentState): ConsentDefinition[] {
  return CONSENTS.filter((consent) => consent.required && !state[consent.id]);
}
