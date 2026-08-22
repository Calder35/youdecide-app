/**
 * The seller happy path, declared once.
 *
 * Screens do not know which screen comes next — they ask `nextStep()`. That
 * keeps the flow order reviewable in a single file and means chunk 2 can insert
 * or reorder a step without touching every screen.
 */

export const ROUTES = {
  Welcome: 'Welcome',
  AccountConsent: 'AccountConsent',
  SellerDiscovery: 'SellerDiscovery',
  OnePercent: 'OnePercent',
  PropertyWorkspace: 'PropertyWorkspace',
  AiPlan: 'AiPlan',
  GetHuman: 'GetHuman',
  Status: 'Status',
  Privacy: 'Privacy',
  DeleteAccount: 'DeleteAccount',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The scripted seller intake, in order. `GetHuman` is deliberately NOT in this
 * list: it is reachable from every screen at any time, not a step you arrive at
 * by finishing the one before it.
 */
export const SELLER_FLOW: readonly RouteName[] = [
  ROUTES.Welcome,
  ROUTES.AccountConsent,
  ROUTES.SellerDiscovery,
  ROUTES.OnePercent,
  ROUTES.PropertyWorkspace,
  ROUTES.AiPlan,
  ROUTES.Status,
] as const;

/** The next step after `current`, or `undefined` at the end of the flow. */
export function nextStep(current: RouteName): RouteName | undefined {
  const index = SELLER_FLOW.indexOf(current);
  if (index < 0) return undefined;
  return SELLER_FLOW[index + 1];
}

/** 1-based position in the flow, for progress copy. `undefined` if off-flow. */
export function stepNumber(current: RouteName): number | undefined {
  const index = SELLER_FLOW.indexOf(current);
  return index < 0 ? undefined : index + 1;
}

export const SELLER_FLOW_LENGTH = SELLER_FLOW.length;
