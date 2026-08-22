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
    required: true,
  },
  {
    id: 'dataUse',
    title: 'Using your information to prepare your listing',
    body: 'We use what you tell us and public property records to prepare your listing, pricing work, and paperwork. We do not sell your information.',
    required: true,
  },
  {
    id: 'contact',
    title: 'Letting a licensed agent contact you',
    body: 'A licensed Nevada agent may call or text you about your sale. Decline and you can still use the app — you would reach out to us instead.',
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
