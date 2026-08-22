/**
 * The 1% math.
 *
 * Deliberately small and pure so the number on screen is one tested function,
 * not arithmetic scattered across a component. Two rules the tests hold us to:
 *
 *   1. The You Decide fee is 1% of the sale price. That is the whole listing-
 *      side fee — there is no second listing fee hiding anywhere.
 *   2. A buyer's-agent commission is a SEPARATE, SELLER-CHOSEN number. It is
 *      not ours, it is not automatic, and it is never folded into the 1% so the
 *      total looks smaller than it is.
 */

/** The listing-side fee rate. The product is named after it; it is not a knob. */
export const LISTING_FEE_RATE = 0.01;

/**
 * A common buyer's-agent offer, used only to pre-fill the example. The seller
 * decides whether to offer anything at all.
 */
export const DEFAULT_BUYER_AGENT_RATE = 0.025;

export type FeeBreakdown = {
  salePrice: number;
  /** What You Decide charges: 1% of the sale price. */
  listingFee: number;
  /** What the seller chose to offer a buyer's agent, if anything. */
  buyerAgentRate: number;
  buyerAgentFee: number;
  /** Everything the seller pays in commission, both sides together. */
  totalCommission: number;
  /** Total commission as a share of the sale price. */
  effectiveRate: number;
  /**
   * What the same sale would cost at a conventional listing-side rate, for
   * comparison. Comparison only — not a promise about any other brokerage.
   */
  conventionalListingFee: number;
  savingsVsConventional: number;
};

/** A conventional listing-side rate, used only for the side-by-side. */
export const CONVENTIONAL_LISTING_RATE = 0.03;

export function calculateFees(
  salePrice: number,
  buyerAgentRate: number = DEFAULT_BUYER_AGENT_RATE,
): FeeBreakdown {
  const price = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : 0;
  const buyerRate = Number.isFinite(buyerAgentRate) && buyerAgentRate > 0 ? buyerAgentRate : 0;

  const listingFee = price * LISTING_FEE_RATE;
  const buyerAgentFee = price * buyerRate;
  const conventionalListingFee = price * CONVENTIONAL_LISTING_RATE;

  return {
    salePrice: price,
    listingFee,
    buyerAgentRate: buyerRate,
    buyerAgentFee,
    totalCommission: listingFee + buyerAgentFee,
    effectiveRate: price === 0 ? 0 : (listingFee + buyerAgentFee) / price,
    conventionalListingFee,
    savingsVsConventional: conventionalListingFee - listingFee,
  };
}

/** Whole dollars — cents in a six-figure number are noise, not precision. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatPercent(rate: number): string {
  const percent = rate * 100;
  const rounded = Math.round(percent * 100) / 100;
  return `${rounded}%`;
}

/**
 * What the 1% buys. Kept next to the math so the promise and the price cannot
 * drift apart in review.
 */
export const INCLUDED: readonly string[] = [
  'Your listing prepared and published to the MLS',
  'Pricing analysis, with the comparable sales it came from',
  'Listing photos coordinated and scheduled',
  'Showing requests handled and organized for you',
  'Every offer reviewed with a licensed Nevada agent before you respond',
  'Contract and disclosure paperwork prepared for your signature',
  'Escrow and closing timeline tracked to the finish',
  'A licensed human reachable at any point, from any screen',
];

/**
 * What it does not. Stated as plainly as the included list — the honesty of the
 * offer is the point, and a seller finding one of these at closing is a failure.
 */
export const EXCLUDED: readonly { item: string; note: string }[] = [
  {
    item: "The buyer's agent commission, if you choose to offer one",
    note: 'You decide whether to offer anything, and how much. It is negotiable and it is separate from our 1%.',
  },
  {
    item: 'Title, escrow, and recording fees',
    note: 'Paid at closing to the title and escrow companies, not to us.',
  },
  {
    item: 'Nevada real property transfer tax',
    note: 'Set by the county and paid at closing. Your escrow officer calculates the exact amount.',
  },
  {
    item: 'HOA transfer and document fees',
    note: "Charged by your HOA if you have one. Their rate, not ours.",
  },
  {
    item: 'Repairs, staging, cleaning, and any home warranty you offer',
    note: 'Your call, your cost. We will tell you what we think matters and what does not.',
  },
  {
    item: 'Legal advice',
    note: 'We are a licensed brokerage, not your attorney. If a sale needs one, we will say so.',
  },
];
