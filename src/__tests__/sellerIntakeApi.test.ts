import { ApiClient } from '../api/client';
import { SELLER_INTAKE_SCOPE } from '../api/config';
import { ApiError } from '../api/errors';
import {
  CONSENT_SCOPE,
  createSeller,
  createWorkspace,
  describeAuditAction,
  readAuditTrail,
  recordGivenConsents,
  requestHumanHelp,
} from '../api/sellerIntake';
import { CONSENTS } from '../data/consents';
import type { DiscoveryAnswers } from '../data/types';
import { createFakeBackend } from '../test-utils/fakeBackend';

const ACCOUNT = { fullName: 'Jordan Rivera', email: 'jordan@example.com', phone: '7025550143' };

const DISCOVERY: DiscoveryAnswers = {
  addressLine: '1200 Sunset Ridge Dr',
  city: 'Henderson',
  zip: '89052',
  timeline: 'In the next 3 months',
  occupancy: 'I live there',
  reason: 'Relocating for work',
};

const FALLBACK = { line1: '4821 Desert Willow Ct', city: 'Las Vegas', postalCode: '89129' };

/** Runs a call that is expected to fail, and hands back the ApiError. */
async function failureFrom(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call();
  } catch (thrown) {
    if (thrown instanceof ApiError) return thrown;
    throw thrown;
  }
  throw new Error('expected the call to fail, but it succeeded');
}

describe('the seller-intake path', () => {
  it('creates a seller, records each consent, opens a workspace, and asks for a human', async () => {
    const backend = createFakeBackend();

    const seller = await createSeller(backend.client, ACCOUNT);
    const recorded = await recordGivenConsents(backend.client, seller.id, {
      terms: true,
      dataUse: true,
      contact: false,
    });
    const journey = await createWorkspace(backend.client, seller.id, DISCOVERY, FALLBACK);
    const intervention = await requestHumanHelp(backend.client, seller.id, journey.id, {
      reason: 'Seller asked for a licensed agent from AiPlan.',
      licensedRequired: true,
    });

    expect(seller.email).toBe('jordan@example.com');
    // Only the consents actually given — the declined one is not sent.
    expect(recorded.map((consent) => consent.scope)).toEqual([
      CONSENT_SCOPE.terms,
      CONSENT_SCOPE.dataUse,
    ]);
    expect(journey.owner_user_id).toBe(seller.id);
    expect(intervention.licensed_required).toBe(true);
    expect(intervention.status).toBe('requested');
  });

  it('sends the property the seller typed, not the sample one', async () => {
    const backend = createFakeBackend();
    const seller = await createSeller(backend.client, ACCOUNT);
    await recordGivenConsents(backend.client, seller.id, {
      terms: true,
      dataUse: true,
      contact: false,
    });
    await createWorkspace(backend.client, seller.id, DISCOVERY, FALLBACK);

    const workspaceRequest = backend.requests.find((request) => request.path === '/v1/journeys');
    expect(workspaceRequest?.body).toMatchObject({
      property: {
        line1: '1200 Sunset Ridge Dr',
        city: 'Henderson',
        postal_code: '89052',
        state: 'NV',
      },
      kind: 'list',
    });
  });

  it('falls back to the sample property when the seller left the address blank', async () => {
    const backend = createFakeBackend();
    const seller = await createSeller(backend.client, ACCOUNT);
    await recordGivenConsents(backend.client, seller.id, {
      terms: true,
      dataUse: true,
      contact: false,
    });
    await createWorkspace(
      backend.client,
      seller.id,
      { ...DISCOVERY, addressLine: '', city: '', zip: '' },
      FALLBACK,
    );

    const workspaceRequest = backend.requests.find((request) => request.path === '/v1/journeys');
    expect(workspaceRequest?.body).toMatchObject({
      property: { line1: FALLBACK.line1, city: FALLBACK.city, postal_code: FALLBACK.postalCode },
    });
  });

  it('records the exact wording the seller saw as the consent evidence', async () => {
    const backend = createFakeBackend();
    const seller = await createSeller(backend.client, ACCOUNT);
    await recordGivenConsents(backend.client, seller.id, {
      terms: true,
      dataUse: false,
      contact: false,
    });

    const consentRequest = backend.requests.find((request) =>
      request.path.endsWith('/consents'),
    );
    const terms = CONSENTS[0];
    expect(consentRequest?.body).toMatchObject({
      scope: CONSENT_SCOPE.terms,
      method: 'mobile_app_checkbox',
      evidence: `${terms.title} — ${terms.body}`,
    });
  });

  it("maps the data-use consent onto the backend's workspace gate", () => {
    // If this mapping breaks, no seller can open a workspace — the gate would
    // never see the scope it requires.
    expect(CONSENT_SCOPE.dataUse).toBe(SELLER_INTAKE_SCOPE);
    expect(SELLER_INTAKE_SCOPE).toBe('seller_intake');
  });

  it('sends the actor header on every route except account creation', async () => {
    const backend = createFakeBackend();
    const seller = await createSeller(backend.client, ACCOUNT);
    await recordGivenConsents(backend.client, seller.id, {
      terms: false,
      dataUse: true,
      contact: false,
    });
    const journey = await createWorkspace(backend.client, seller.id, DISCOVERY, FALLBACK);
    await readAuditTrail(backend.client, seller.id, journey.id);

    const [create, ...rest] = backend.requests;
    expect(create.actorId).toBeUndefined();
    for (const request of rest) {
      expect(`${request.path}:${request.actorId}`).toBe(`${request.path}:${seller.id}`);
    }
  });

  it('returns the audit trail the backend actually wrote', async () => {
    const backend = createFakeBackend();
    const seller = await createSeller(backend.client, ACCOUNT);
    await recordGivenConsents(backend.client, seller.id, {
      terms: true,
      dataUse: true,
      contact: false,
    });
    const journey = await createWorkspace(backend.client, seller.id, DISCOVERY, FALLBACK);
    await requestHumanHelp(backend.client, seller.id, journey.id, {
      reason: 'Please call',
      licensedRequired: true,
    });

    const trail = await readAuditTrail(backend.client, seller.id, journey.id);
    expect(trail.map((entry) => entry.action)).toEqual([
      'property.created',
      'journey.created',
      'human_intervention.requested',
    ]);
    // Shown to a seller in their language, not as an event name.
    expect(describeAuditAction('journey.created')).toBe('Your workspace was opened');
    // An action we have no phrase for is shown, not hidden.
    expect(describeAuditAction('something.new')).toBe('something.new');
  });
});

describe('when the backend says no', () => {
  it('explains the consent gate as an unchecked box, not as "forbidden"', async () => {
    const backend = createFakeBackend();
    const seller = await createSeller(backend.client, ACCOUNT);
    // Consent given for the wrong scope — the gate refuses.
    await recordGivenConsents(backend.client, seller.id, {
      terms: true,
      dataUse: false,
      contact: false,
    });

    const failure = await failureFrom(() => createWorkspace(backend.client, seller.id, DISCOVERY, FALLBACK));

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.kind).toBe('consentRequired');
    expect(failure.sellerMessage).toMatch(/give the two required agreements/);
    expect(failure.retryable).toBe(false);
  });

  it('names a duplicate email as a duplicate email', async () => {
    const backend = createFakeBackend();
    await createSeller(backend.client, ACCOUNT);
    const failure = await failureFrom(() => createSeller(backend.client, ACCOUNT));
    expect(failure.kind).toBe('conflict');
    expect(failure.sellerMessage).toMatch(/already exists/);
  });

  it('treats a server fault as ours and retryable, and still points at a human', async () => {
    const backend = createFakeBackend({ failWith: { status: 500, detail: 'boom' } });
    const failure = await failureFrom(() => createSeller(backend.client, ACCOUNT));
    expect(failure.kind).toBe('server');
    expect(failure.retryable).toBe(true);
    expect(failure.sellerMessage).toMatch(/Nothing you did caused it/);
    expect(failure.sellerMessage).toMatch(/Get a human/);
  });

  it('turns a dead network into something a person can act on', async () => {
    const backend = createFakeBackend({ networkDown: true });
    const failure = await failureFrom(() => createSeller(backend.client, ACCOUNT));
    expect(failure.kind).toBe('network');
    expect(failure.sellerMessage).toMatch(/Check your connection/);
  });

  it('stops waiting rather than hanging forever', async () => {
    const client = new ApiClient({
      config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
      timeoutMs: 5,
      fetchImpl: ((_input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })) as unknown as typeof fetch,
    });

    const failure = await failureFrom(() => createSeller(client, ACCOUNT));
    expect(failure.kind).toBe('timeout');
    expect(failure.retryable).toBe(true);
  });

  it('refuses to send anything at all in an offline build', async () => {
    const client = new ApiClient({ config: { mode: 'offline', baseUrl: '' } });
    expect(client.isConnected).toBe(false);
    const failure = await failureFrom(() => createSeller(client, ACCOUNT));
    expect(failure.kind).toBe('offline');
    expect(failure.sellerMessage).toMatch(/not connected to the test API/);
  });
});
