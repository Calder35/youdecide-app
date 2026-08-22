/**
 * The shapes the seller flow works in.
 *
 * The important one is `Sourced<T>`: in this product a number never travels
 * alone. Every figure the app shows carries where it came from and how sure we
 * are — so the type system makes it awkward to display a bare number. Chunk 3
 * builds the component that renders this; chunk 2 establishes the data.
 */

/** How much weight a seller should put on a figure. */
export type Confidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

/** Plain-language explanation of what each level means. Shown, not hidden. */
export const CONFIDENCE_MEANING: Record<Confidence, string> = {
  high: 'From an official record, or something you told us directly.',
  medium: 'Estimated from comparable homes. Worth a human check.',
  low: 'A rough starting point. Do not rely on this without a licensed agent.',
};

/** A value plus its provenance. Nothing user-facing should be a bare number. */
export type Sourced<T> = {
  value: T;
  /** Where it came from, in the words we'd say out loud. */
  source: string;
  confidence: Confidence;
  /** When the source was read, ISO date. Stale data is its own kind of wrong. */
  asOf?: string;
};

export function sourced<T>(
  value: T,
  source: string,
  confidence: Confidence,
  asOf?: string,
): Sourced<T> {
  return { value, source, confidence, asOf };
}

/** One consent, recorded separately — never a single blanket checkbox. */
export type ConsentId = 'terms' | 'dataUse' | 'contact';

export type ConsentDefinition = {
  id: ConsentId;
  title: string;
  /** What the seller is agreeing to, in one or two plain sentences. */
  body: string;
  /** Required consents block progress; optional ones never do. */
  required: boolean;
};

export type ConsentState = Record<ConsentId, boolean>;

export type SellerAccount = {
  fullName: string;
  email: string;
  phone: string;
};

/** Answers from seller discovery. All optional — the flow never hard-blocks. */
export type DiscoveryAnswers = {
  addressLine: string;
  city: string;
  zip: string;
  timeline: TimelineChoice | null;
  occupancy: OccupancyChoice | null;
  reason: string;
};

export const TIMELINE_CHOICES = [
  'As soon as possible',
  'In the next 3 months',
  'In 3–6 months',
  'Just exploring',
] as const;
export type TimelineChoice = (typeof TIMELINE_CHOICES)[number];

export const OCCUPANCY_CHOICES = [
  'I live there',
  'Tenant-occupied',
  'Vacant',
] as const;
export type OccupancyChoice = (typeof OCCUPANCY_CHOICES)[number];

/** One fact in the property workspace. */
export type PropertyFact = {
  id: string;
  label: string;
  /** Already formatted for display — formatting is a data concern here. */
  display: Sourced<string>;
  /** True when the seller corrected what we pulled. */
  correctedBySeller?: boolean;
};

export type DocumentStatus = 'needed' | 'uploaded' | 'notApplicable';

export type PropertyDocument = {
  id: string;
  label: string;
  why: string;
  status: DocumentStatus;
};

/** One step in the AI's listing plan. */
export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  /** What the AI based this on. */
  basis: Sourced<string>;
  /** Steps a licensed human must approve before they can happen. */
  needsHumanApproval: boolean;
  done: boolean;
};

export type TimelineEntry = {
  id: string;
  label: string;
  detail: string;
  state: 'done' | 'inProgress' | 'waitingOnHuman' | 'upcoming';
};
