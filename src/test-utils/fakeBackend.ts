import { ApiClient } from '../api/client';

/**
 * A stand-in for the backend's thin seller-intake path.
 *
 * It mirrors `app/api/routes.py` closely enough to be worth testing against:
 * the consent gate really refuses, the actor header really matters, and the
 * audit trail really grows. A fake that always says yes would prove nothing.
 */

export type RecordedRequest = {
  method: string;
  path: string;
  actorId?: string;
  body?: unknown;
};

type FakeOptions = {
  /** Fail the next N requests with this status, to exercise error handling. */
  failWith?: { status: number; detail?: string; times?: number };
  /** Throw a network error instead of responding. */
  networkDown?: boolean;
};

export function createFakeBackend(options: FakeOptions = {}) {
  const requests: RecordedRequest[] = [];
  const users = new Map<string, { id: string; email: string }>();
  const consents = new Map<string, string[]>(); // userId → scopes
  const journeys = new Map<string, { id: string; owner: string }>();
  const audit: { seq: number; action: string; journey_id: string | null }[] = [];
  let failuresLeft = options.failWith?.times ?? (options.failWith !== undefined ? Infinity : 0);
  let nextId = 1;

  const id = (prefix: string) => `${prefix}-${nextId++}`;

  function record(action: string, journeyId: string | null) {
    audit.push({ seq: audit.length + 1, action, journey_id: journeyId });
  }

  function json(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const actorId = headers['X-Actor-Id'];
    const body = init?.body !== undefined ? JSON.parse(String(init.body)) : undefined;

    requests.push({ method, path, actorId, body });

    if (options.networkDown === true) {
      throw new TypeError('Network request failed');
    }

    if (failuresLeft > 0 && options.failWith !== undefined) {
      failuresLeft -= 1;
      return json(options.failWith.status, { detail: options.failWith.detail ?? 'failed' });
    }

    // POST /v1/users — the only route with no actor.
    if (method === 'POST' && path === '/v1/users') {
      const existing = [...users.values()].find((user) => user.email === body.email);
      if (existing !== undefined) {
        return json(409, { detail: 'a user with that email already exists' });
      }
      const userId = id('user');
      users.set(userId, { id: userId, email: body.email });
      consents.set(userId, []);
      record('user.created', null);
      return json(201, {
        id: userId,
        email: body.email,
        display_name: body.display_name,
        role: body.role,
      });
    }

    if (actorId === undefined || !users.has(actorId)) {
      return json(401, { detail: 'X-Actor-Id header is required' });
    }

    // POST /v1/users/{id}/consents
    const consentMatch = /^\/v1\/users\/([^/]+)\/consents$/.exec(path);
    if (method === 'POST' && consentMatch !== null) {
      const userId = consentMatch[1];
      if (userId !== actorId) {
        return json(403, { detail: 'you may not grant consent for another user' });
      }
      consents.set(userId, [...(consents.get(userId) ?? []), body.scope]);
      record('consent.granted', null);
      return json(201, {
        id: id('consent'),
        user_id: userId,
        scope: body.scope,
        text_version: '2026-08-19.v1',
        active: true,
      });
    }

    // POST /v1/journeys — THE CONSENT GATE.
    if (method === 'POST' && path === '/v1/journeys') {
      if (!(consents.get(actorId) ?? []).includes('seller_intake')) {
        return json(403, {
          detail: "no active 'seller_intake' consent on record for this user",
        });
      }
      const journeyId = id('journey');
      journeys.set(journeyId, { id: journeyId, owner: actorId });
      record('property.created', journeyId);
      record('journey.created', journeyId);
      return json(201, {
        id: journeyId,
        property_id: id('property'),
        owner_user_id: actorId,
        kind: body.kind,
        status: 'open',
        consent_id: id('consent'),
      });
    }

    // POST /v1/journeys/{id}/human-help
    const helpMatch = /^\/v1\/journeys\/([^/]+)\/human-help$/.exec(path);
    if (method === 'POST' && helpMatch !== null) {
      const journey = journeys.get(helpMatch[1]);
      if (journey === undefined || journey.owner !== actorId) {
        return json(404, { detail: 'journey not found' });
      }
      record('human_intervention.requested', journey.id);
      return json(201, {
        id: id('intervention'),
        journey_id: journey.id,
        reason: body.reason,
        licensed_required: body.licensed_required,
        status: 'requested',
      });
    }

    // GET /v1/journeys/{id}/audit
    const auditMatch = /^\/v1\/journeys\/([^/]+)\/audit$/.exec(path);
    if (method === 'GET' && auditMatch !== null) {
      const journey = journeys.get(auditMatch[1]);
      if (journey === undefined || journey.owner !== actorId) {
        return json(404, { detail: 'journey not found' });
      }
      return json(
        200,
        audit
          .filter((entry) => entry.journey_id === journey.id)
          .map((entry) => ({
            seq: entry.seq,
            action: entry.action,
            entity_type: 'journey',
            entity_id: journey.id,
            actor_user_id: actorId,
            journey_id: journey.id,
          })),
      );
    }

    return json(404, { detail: 'not found' });
  };

  return {
    requests,
    audit,
    fetchImpl,
    client: new ApiClient({
      config: { mode: 'test-api', baseUrl: 'http://localhost:8000' },
      fetchImpl,
    }),
  };
}
