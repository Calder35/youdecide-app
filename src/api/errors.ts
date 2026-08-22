/**
 * What went wrong, said in a way a seller can act on.
 *
 * Every failure that reaches a screen goes through here. The rule, same as the
 * rest of the app: an error names what happened AND what to do next. "Request
 * failed with status 403" is not an error message, it is a stack trace with
 * punctuation.
 */

export type ApiFailureKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'consentRequired'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'invalid'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiFailureKind;
  /** HTTP status, when there was one. */
  readonly status?: number;
  /** What a seller should be told. Safe to render. */
  readonly sellerMessage: string;
  /** Whether trying the same thing again could plausibly work. */
  readonly retryable: boolean;
  /** The backend's own `detail`, kept for the log — never shown raw. */
  readonly detail?: string;

  constructor(init: {
    kind: ApiFailureKind;
    sellerMessage: string;
    retryable: boolean;
    status?: number;
    detail?: string;
  }) {
    super(`${init.kind}${init.status !== undefined ? ` (${init.status})` : ''}: ${init.detail ?? init.sellerMessage}`);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.sellerMessage = init.sellerMessage;
    this.retryable = init.retryable;
    this.detail = init.detail;
  }
}

const HUMAN_FALLBACK =
  ' You can still reach a person — the “Get a human” bar at the bottom of every screen always works.';

/** Map an HTTP response to a failure a seller can understand. */
export function errorFromStatus(status: number, detail?: string): ApiError {
  if (status === 401) {
    return new ApiError({
      kind: 'unauthorized',
      status,
      detail,
      sellerMessage:
        'We lost track of your session. Go back to the account screen and set your details up again.',
      retryable: false,
    });
  }

  if (status === 403) {
    // The backend's one 403 on this path is the consent gate, and it is worth
    // naming precisely — "forbidden" would send a seller hunting for a problem
    // that is really just an unchecked box.
    const isConsentGate = (detail ?? '').toLowerCase().includes('consent');
    return new ApiError({
      kind: isConsentGate ? 'consentRequired' : 'forbidden',
      status,
      detail,
      sellerMessage: isConsentGate
        ? 'Your workspace needs your consent on record first. Go back to the account screen and give the two required agreements.'
        : 'That is not something this account can do.',
      retryable: false,
    });
  }

  if (status === 404) {
    return new ApiError({
      kind: 'notFound',
      status,
      detail,
      sellerMessage: 'We could not find that. Start the workspace again from the property screen.',
      retryable: false,
    });
  }

  if (status === 409) {
    return new ApiError({
      kind: 'conflict',
      status,
      detail,
      sellerMessage: 'An account already exists with that email. Use a different one for this test run.',
      retryable: false,
    });
  }

  if (status === 422 || status === 400) {
    return new ApiError({
      kind: 'invalid',
      status,
      detail,
      sellerMessage: 'Something in what we sent was not accepted. Check your details and try again.',
      retryable: false,
    });
  }

  if (status >= 500) {
    return new ApiError({
      kind: 'server',
      status,
      detail,
      sellerMessage: `You Decide had a problem on its end. Nothing you did caused it. Try again in a moment.${HUMAN_FALLBACK}`,
      retryable: true,
    });
  }

  return new ApiError({
    kind: 'unknown',
    status,
    detail,
    sellerMessage: `Something went wrong we did not expect.${HUMAN_FALLBACK}`,
    retryable: true,
  });
}

export const OFFLINE_ERROR = () =>
  new ApiError({
    kind: 'offline',
    sellerMessage:
      'This build is not connected to the test API, so nothing was sent. Everything on screen is sample data.',
    retryable: false,
  });

export const NETWORK_ERROR = (detail?: string) =>
  new ApiError({
    kind: 'network',
    detail,
    sellerMessage: `We could not reach You Decide. Check your connection and try again.${HUMAN_FALLBACK}`,
    retryable: true,
  });

export const TIMEOUT_ERROR = () =>
  new ApiError({
    kind: 'timeout',
    sellerMessage: `That took longer than expected, so we stopped waiting. Try again.${HUMAN_FALLBACK}`,
    retryable: true,
  });

/** Anything thrown, turned into something renderable. */
export function toApiError(thrown: unknown): ApiError {
  if (thrown instanceof ApiError) return thrown;
  if (thrown instanceof Error && thrown.name === 'AbortError') return TIMEOUT_ERROR();
  return NETWORK_ERROR(thrown instanceof Error ? thrown.message : String(thrown));
}
