/**
 * ⚠️  DRAFT — PENDING LICENSED NEVADA REVIEW  ⚠️
 *
 * EVERY string in this file makes a claim about Nevada real estate practice,
 * disclosure requirements, retention rules, or brokerage obligations. All of it
 * was written by an engineer, NOT by a licensed Nevada agent or an attorney,
 * and NONE of it has been reviewed.
 *
 * Rules for this file:
 *
 *   1. Nothing here reaches a real seller until a licensed Nevada agent has
 *      reviewed and signed off on it. Every screen that renders this copy also
 *      renders `<DraftNotice />`, and a test enforces that pairing.
 *   2. Do not expand this file. Adding a new Nevada-specific claim adds another
 *      thing needing review. If a screen can say something without asserting
 *      what Nevada requires, say that instead.
 *   3. Keep claims general and hedged. No statute numbers, no rates, no
 *      deadlines, no dollar figures. Where an exact answer matters, point the
 *      seller at the person whose job it is to know.
 *
 * Sign-off: when a licensed Nevada agent has reviewed this copy, replace
 * REVIEW_STATUS with 'reviewed' and record who reviewed it and when. The
 * DraftNotice disappears from every screen at that point, automatically.
 */

export const REVIEW_STATUS = 'pending-licensed-nv-review' as const;

export type ReviewStatus = typeof REVIEW_STATUS | 'reviewed';

export type DraftCopy = {
  text: string;
  review: ReviewStatus;
};

/** Marks a string as an unreviewed Nevada-specific claim. */
function draft(text: string): DraftCopy {
  return { text, review: REVIEW_STATUS };
}

/** True while any Nevada copy is still awaiting sign-off. */
export const NEVADA_COPY_IS_DRAFT: boolean = REVIEW_STATUS === 'pending-licensed-nv-review';

export const DRAFT_NOTICE_TITLE = 'DRAFT — pending licensed NV review';

export const DRAFT_NOTICE_BODY =
  'The Nevada-specific wording on this screen was written for a preview build and has not been reviewed by a licensed Nevada agent. Do not rely on it. A licensed agent gives you the real answer.';

/**
 * The Nevada claims, all of them, in one place.
 *
 * Deliberately short. Each entry is one hedged sentence — the detail belongs
 * with the licensed human, not in app copy.
 */
export const NEVADA_COPY = {
  sellerDisclosure: draft(
    'Nevada requires sellers to give buyers a written disclosure about the property. We prepare a draft; you review every line, and a licensed agent checks it before it goes anywhere.',
  ),
  hoaDocuments: draft(
    'If your home is in an HOA, Nevada buyers are entitled to HOA documents. Requesting them early tends to avoid a delay later — your agent will confirm what your association provides.',
  ),
  transferTax: draft(
    'Nevada charges a real property transfer tax at closing. The county sets it and your escrow officer calculates the exact amount — it is not part of our fee.',
  ),
  tenantOccupied: draft(
    'A tenant in the home changes how showings and notice work in Nevada. A licensed agent will walk through what applies to your situation before anything is scheduled.',
  ),
  recordRetention: draft(
    'A Nevada brokerage has to retain records tied to a completed transaction, so some paperwork survives an account deletion. A licensed agent will tell you exactly what remains.',
  ),
  licensedSupervision: draft(
    'A licensed Nevada agent reviews the listing before it is published. The app cannot publish on its own.',
  ),
} as const satisfies Record<string, DraftCopy>;

export type NevadaCopyKey = keyof typeof NEVADA_COPY;

/** Convenience for screens: the text, still marked as draft by DraftNotice. */
export function nv(key: NevadaCopyKey): string {
  return NEVADA_COPY[key].text;
}
