/**
 * Mock data for the prototype.
 *
 * Everything here stands in for a backend response in chunk 4. It is shaped
 * exactly like the real thing — including every `Sourced` wrapper — so wiring
 * the API later swaps the source of the data, not the screens.
 *
 * The address is a deliberately fake Las Vegas one. No real property, no real
 * person.
 */

import { nv } from '../content/nevada';
import type { PlanStep, PropertyDocument, PropertyFact, TimelineEntry } from './types';
import { sourced } from './types';

export const MOCK_PROPERTY_ADDRESS = '4821 Desert Willow Ct, Las Vegas, NV 89129';

export const MOCK_ESTIMATED_VALUE = 452000;

export const MOCK_PROPERTY_FACTS: readonly PropertyFact[] = [
  {
    id: 'estimate',
    label: 'Estimated sale price',
    display: sourced(
      '$438,000 – $466,000',
      '7 comparable sales within 0.6 miles, closed in the last 90 days',
      'medium',
      '2026-08-14',
    ),
  },
  {
    id: 'beds-baths',
    label: 'Beds / baths',
    display: sourced('4 bed / 3 bath', 'Clark County Assessor record', 'high', '2026-07-01'),
  },
  {
    id: 'sqft',
    label: 'Living area',
    display: sourced('2,410 sq ft', 'Clark County Assessor record', 'high', '2026-07-01'),
  },
  {
    id: 'lot',
    label: 'Lot size',
    display: sourced('6,098 sq ft', 'Clark County Assessor record', 'high', '2026-07-01'),
  },
  {
    id: 'year-built',
    label: 'Year built',
    display: sourced('2004', 'Clark County Assessor record', 'high', '2026-07-01'),
  },
  {
    id: 'hoa',
    label: 'HOA dues',
    display: sourced(
      'About $65 / month',
      'Listing history for this subdivision — not confirmed with your HOA yet',
      'low',
      '2026-08-14',
    ),
  },
  {
    id: 'condition',
    label: 'Condition',
    display: sourced(
      'Not assessed yet',
      'Nobody has seen the home. This gets filled in after your walkthrough.',
      'low',
    ),
  },
];

export const MOCK_DOCUMENTS: readonly PropertyDocument[] = [
  {
    id: 'deed',
    label: 'Deed or title report',
    why: 'Confirms who can legally sell the home.',
    status: 'needed',
  },
  {
    id: 'hoa-docs',
    label: 'HOA documents',
    // Nevada-specific claim — DRAFT, see src/content/nevada.ts.
    why: nv('hoaDocuments'),
    status: 'needed',
  },
  {
    id: 'spds',
    label: "Seller's Real Property Disclosure",
    // Nevada-specific claim — DRAFT, see src/content/nevada.ts.
    why: nv('sellerDisclosure'),
    status: 'needed',
  },
  {
    id: 'mortgage',
    label: 'Current mortgage statement',
    why: 'Used to estimate what you walk away with.',
    status: 'needed',
  },
  {
    id: 'warranty',
    label: 'Appliance or roof warranties',
    why: 'Nice to have. Skip it if you do not have them.',
    status: 'notApplicable',
  },
];

export const MOCK_PLAN: readonly PlanStep[] = [
  {
    id: 'walkthrough',
    title: 'Book your photo and walkthrough visit',
    detail:
      'A photographer and a licensed agent see the home together. That visit is what turns the condition line in your workspace from a guess into a fact.',
    basis: sourced(
      'Homes in this ZIP with professional photos went under contract about 9 days sooner than those without.',
      'Comparable listing history, 89129, last 12 months',
      'medium',
      '2026-08-14',
    ),
    needsHumanApproval: false,
    done: false,
  },
  {
    id: 'price',
    title: 'Settle on a list price with an agent',
    detail:
      'Our range is $438,000–$466,000. Where you land inside it depends on condition, which nobody has seen yet. A licensed agent sets the final number with you.',
    basis: sourced(
      '7 comparable sales within 0.6 miles, closed in the last 90 days',
      'Clark County recorded sales',
      'medium',
      '2026-08-14',
    ),
    needsHumanApproval: true,
    done: false,
  },
  {
    id: 'prep',
    title: 'Three prep items worth doing, and two that are not',
    detail:
      'Worth it: deep clean, declutter the front rooms, fix the side-gate latch. Skip: repainting the interior, replacing the kitchen counters. Neither pays for itself at this price point.',
    basis: sourced(
      'Buyer feedback and price-per-square-foot patterns in nearby closed sales',
      'Comparable sales analysis, 89129',
      'low',
      '2026-08-14',
    ),
    needsHumanApproval: false,
    done: false,
  },
  {
    id: 'disclosures',
    title: 'Prepare your seller disclosures',
    // Nevada-specific claim — DRAFT, see src/content/nevada.ts.
    detail: nv('sellerDisclosure'),
    basis: sourced(
      'Nevada disclosure practice',
      'Draft copy pending review by a licensed Nevada agent',
      'low',
    ),
    needsHumanApproval: true,
    done: false,
  },
  {
    id: 'publish',
    title: 'Publish the listing',
    // Nevada-specific claim — DRAFT, see src/content/nevada.ts.
    detail: nv('licensedSupervision'),
    basis: sourced(
      'A licensed agent must review the listing before it is published',
      'You Decide supervision policy',
      'high',
    ),
    needsHumanApproval: true,
    done: false,
  },
];

export const MOCK_TIMELINE: readonly TimelineEntry[] = [
  {
    id: 'account',
    label: 'Account created',
    detail: 'Your consents are recorded, each one separately.',
    state: 'done',
  },
  {
    id: 'workspace',
    label: 'Property workspace opened',
    detail: 'Public records pulled. Condition still needs a person to look at it.',
    state: 'done',
  },
  {
    id: 'plan',
    label: 'Listing plan drafted',
    detail: 'Five steps, three of which a licensed agent has to approve.',
    state: 'done',
  },
  {
    id: 'human',
    label: 'Waiting on a licensed agent',
    detail: 'Typical response is within one business day.',
    state: 'waitingOnHuman',
  },
  {
    id: 'photos',
    label: 'Photos and walkthrough',
    detail: 'Scheduled once an agent picks up your request.',
    state: 'upcoming',
  },
  {
    id: 'live',
    label: 'Listing published',
    detail: 'Only after you and a licensed agent both approve it.',
    state: 'upcoming',
  },
];
