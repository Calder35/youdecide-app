/**
 * What transfers when a seller asks for a human.
 *
 * The disclosure on the handoff screen is BUILT FROM THIS FUNCTION, and chunk 4
 * will send this same object. That is the point: the list a seller reads cannot
 * drift from what is actually sent, because there is only one list.
 *
 * If a future change adds a field to the payload and not to the summary, the
 * test in `handoff.test.ts` fails.
 */

import type { SellerSessionState } from '../state/SellerSession';
import { CONSENTS } from './consents';
import type { PlanStep } from './types';

export type HandoffPayload = {
  /** Who is asking. */
  contact: {
    fullName: string;
    email: string;
    phone: string;
  };
  /** Which screen they asked from. */
  askedFrom: string;
  /** What they typed in the note field, if anything. */
  note: string;
  property: {
    address: string;
  };
  discovery: {
    timeline: string | null;
    occupancy: string | null;
    reason: string;
  };
  /** Each consent and whether it was given — the record, not a summary of it. */
  consents: { id: string; title: string; given: boolean }[];
  /** The plan as it stands, so the agent picks up where the seller left off. */
  plan: { id: string; title: string; done: boolean; needsHumanApproval: boolean }[];
};

export function buildHandoffPayload(
  state: SellerSessionState,
  options: { askedFrom: string; note: string; propertyAddress: string; plan: readonly PlanStep[] },
): HandoffPayload {
  return {
    contact: {
      fullName: state.account.fullName,
      email: state.account.email,
      phone: state.account.phone,
    },
    askedFrom: options.askedFrom,
    note: options.note,
    property: {
      address: options.propertyAddress,
    },
    discovery: {
      timeline: state.discovery.timeline,
      occupancy: state.discovery.occupancy,
      reason: state.discovery.reason,
    },
    consents: CONSENTS.map((consent) => ({
      id: consent.id,
      title: consent.title,
      given: state.consents[consent.id],
    })),
    plan: options.plan.map((step) => ({
      id: step.id,
      title: step.title,
      done: state.completedPlanSteps.includes(step.id),
      needsHumanApproval: step.needsHumanApproval,
    })),
  };
}

export type HandoffLine = {
  label: string;
  /** What actually goes across, or a plain note that nothing was entered. */
  value: string;
};

/**
 * The disclosure, derived from the payload above. One line per top-level thing
 * that transfers, in the seller's language.
 */
export function summarizeHandoff(payload: HandoffPayload): HandoffLine[] {
  const givenConsents = payload.consents.filter((consent) => consent.given).length;
  const doneSteps = payload.plan.filter((step) => step.done).length;

  return [
    {
      label: 'Your name',
      value: orNothing(payload.contact.fullName, "you haven't entered one"),
    },
    {
      label: 'Your email',
      value: orNothing(payload.contact.email, "you haven't entered one"),
    },
    {
      label: 'Your phone',
      value: orNothing(payload.contact.phone, "you haven't entered one"),
    },
    { label: 'The property', value: payload.property.address },
    {
      label: 'Your timeline',
      value: orNothing(payload.discovery.timeline ?? '', 'not answered yet'),
    },
    {
      label: 'Who lives there',
      value: orNothing(payload.discovery.occupancy ?? '', 'not answered yet'),
    },
    {
      label: 'Why you are selling',
      value: orNothing(payload.discovery.reason, 'not answered yet'),
    },
    {
      label: 'Your consent record',
      value: `${givenConsents} of ${payload.consents.length} agreements given`,
    },
    {
      label: 'Your listing plan',
      value: `${payload.plan.length} steps, ${doneSteps} marked done`,
    },
    { label: 'Where you asked from', value: payload.askedFrom },
    {
      label: 'Your note',
      value: orNothing(payload.note, 'no note added'),
    },
  ];
}

function orNothing(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : `— ${fallback}`;
}

/**
 * Things a seller might reasonably worry about that we do NOT send. Stated
 * outright, because "what we don't take" is half of what makes a disclosure
 * trustworthy.
 */
export const NOT_SHARED: readonly string[] = [
  'Your device location',
  'Your contacts, photos, or anything else on your phone',
  'Any financial account or payment information',
];
