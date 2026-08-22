import { CONSENTS } from '../data/consents';
import type { ConsentId, ConsentState, DiscoveryAnswers, SellerAccount } from '../data/types';
import type { ApiClient } from './client';
import { SELLER_INTAKE_SCOPE } from './config';
import type {
  AuditEntryResponse,
  ConsentResponse,
  CreateUserRequest,
  CreateWorkspaceRequest,
  HumanInterventionResponse,
  JourneyResponse,
  UserResponse,
} from './types';

/**
 * The seller-intake path, app side:
 *
 *   create seller → record consent → create property workspace
 *                 → request human help → read the audit trail
 *
 * Mirrors `app/api/routes.py` in the backend. Each function is one route; the
 * orchestration lives in the session store, not here, so these stay testable
 * against a fake `fetch`.
 */

/**
 * Our three consents, mapped onto the backend's scope strings.
 *
 * `dataUse` maps to the backend's `seller_intake` scope because that is the
 * gate on creating a property workspace — the agreement to let us use the
 * seller's information to prepare their listing IS the thing the workspace
 * needs. The other two are recorded separately and gate nothing.
 *
 * If the backend's `SELLER_INTAKE_SCOPE` ever changes, `config.ts` is the one
 * place to edit and a test asserts this mapping still points at it.
 */
export const CONSENT_SCOPE: Record<ConsentId, string> = {
  terms: 'terms_of_service',
  dataUse: SELLER_INTAKE_SCOPE,
  contact: 'agent_contact',
};

export async function createSeller(
  client: ApiClient,
  account: SellerAccount,
): Promise<UserResponse> {
  const body: CreateUserRequest = {
    email: account.email.trim(),
    display_name: account.fullName.trim(),
    role: 'seller',
  };
  return client.request<UserResponse>({ method: 'POST', path: '/v1/users', body });
}

/**
 * Record one consent. The evidence we send is the EXACT wording the seller saw,
 * because "what did they agree to" is the only question this record has to be
 * able to answer later.
 */
export async function recordConsent(
  client: ApiClient,
  sellerId: string,
  consentId: ConsentId,
): Promise<ConsentResponse> {
  const definition = CONSENTS.find((consent) => consent.id === consentId);
  if (definition === undefined) {
    throw new Error(`Unknown consent "${consentId}"`);
  }

  return client.request<ConsentResponse>({
    method: 'POST',
    path: `/v1/users/${sellerId}/consents`,
    actorId: sellerId,
    body: {
      scope: CONSENT_SCOPE[consentId],
      method: 'mobile_app_checkbox',
      evidence: `${definition.title} — ${definition.body}`,
    },
  });
}

/** Every consent the seller actually gave, recorded one at a time. */
export async function recordGivenConsents(
  client: ApiClient,
  sellerId: string,
  consents: ConsentState,
): Promise<ConsentResponse[]> {
  const given = CONSENTS.filter((consent) => consents[consent.id]);
  const recorded: ConsentResponse[] = [];
  // Sequential on purpose: each grant writes an audit row, and a readable
  // audit trail is worth more here than three parallel requests.
  for (const consent of given) {
    recorded.push(await recordConsent(client, sellerId, consent.id));
  }
  return recorded;
}

export async function createWorkspace(
  client: ApiClient,
  sellerId: string,
  discovery: DiscoveryAnswers,
  fallbackAddress: { line1: string; city: string; postalCode: string },
): Promise<JourneyResponse> {
  const body: CreateWorkspaceRequest = {
    property: {
      line1: orFallback(discovery.addressLine, fallbackAddress.line1),
      line2: '',
      city: orFallback(discovery.city, fallbackAddress.city),
      state: 'NV',
      postal_code: orFallback(discovery.zip, fallbackAddress.postalCode),
      apn: '',
    },
    kind: 'list',
  };

  return client.request<JourneyResponse>({
    method: 'POST',
    path: '/v1/journeys',
    actorId: sellerId,
    body,
  });
}

export async function requestHumanHelp(
  client: ApiClient,
  sellerId: string,
  journeyId: string,
  input: { reason: string; licensedRequired: boolean },
): Promise<HumanInterventionResponse> {
  return client.request<HumanInterventionResponse>({
    method: 'POST',
    path: `/v1/journeys/${journeyId}/human-help`,
    actorId: sellerId,
    body: {
      reason: input.reason,
      licensed_required: input.licensedRequired,
    },
  });
}

export async function readAuditTrail(
  client: ApiClient,
  sellerId: string,
  journeyId: string,
): Promise<AuditEntryResponse[]> {
  return client.request<AuditEntryResponse[]>({
    method: 'GET',
    path: `/v1/journeys/${journeyId}/audit`,
    actorId: sellerId,
  });
}

function orFallback(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Audit actions, in the seller's language.
 *
 * The audit trail is a trust surface, not a debug log: showing a seller
 * "journey.created" teaches them nothing. Anything we do not have a phrase for
 * is shown as-is rather than hidden, because a record with rows missing is
 * worse than a record with an ugly row.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'user.created': 'Your account was created',
  'consent.granted': 'You gave an agreement, and it was recorded',
  'property.created': 'Your property was added',
  'journey.created': 'Your workspace was opened',
  'human_intervention.requested': 'You asked for a licensed human',
};

export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}
