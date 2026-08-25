import { REQUEST_TIMEOUT_MS, resolveApiConfig, type ApiConfig } from './config';
import { OFFLINE_ERROR, errorFromStatus, toApiError } from './errors';

/**
 * The HTTP client.
 *
 * Small on purpose — it does four things and no more: attach the actor header,
 * time out, parse JSON, and turn a failure into an `ApiError` a screen can
 * render. Everything policy-shaped (which hosts, which scope) lives in
 * `config.ts`; everything seller-facing lives in `errors.ts`.
 *
 * TEST-ENV AUTH: the backend identifies the caller from an `X-Actor-Id` header
 * naming a user row. That is not authentication, and the backend says so in
 * `app/security.py`. Nothing here should be mistaken for a login.
 */

export type RequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  /** The acting user id. Omitted only for POST /v1/users, which creates one. */
  actorId?: string;
  signal?: AbortSignal;
  /** Overrides the client default. The chat endpoint is a model call. */
  timeoutMs?: number;
};

export class ApiClient {
  private readonly config: ApiConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: { config?: ApiConfig; fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {
    this.config = options.config ?? resolveApiConfig();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  get mode() {
    return this.config.mode;
  }

  get baseUrl() {
    return this.config.baseUrl;
  }

  get isConnected() {
    return this.config.mode === 'test-api';
  }

  /**
   * Opens the connection ahead of a request that is about to matter.
   *
   * A cold TLS handshake to the backend measured 0.40-0.50s; a warm one 0.09s.
   * That difference sits in front of the FIRST spoken turn of a conversation —
   * the one where someone is deciding whether this thing works. Entering voice
   * mode fires this so the handshake happens while they are still drawing
   * breath.
   *
   * Deliberately silent. It is an optimisation, and an optimisation that can
   * report a failure is a bug waiting to be filed against a working app.
   */
  async warmUp(): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.request<unknown>({ method: 'GET', path: '/health', timeoutMs: 3_000 });
    } catch {
      // Nothing to do and nothing to say. The real request will report for real.
    }
  }

  async request<T>(options: RequestOptions): Promise<T> {
    if (this.config.mode === 'offline') {
      // Not an exception path — this is the default build. Callers check
      // `isConnected` first; throwing here is the backstop against a screen
      // that forgets to.
      throw OFFLINE_ERROR();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
    if (options.signal !== undefined) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}${options.path}`, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // TEST ENV ONLY — see the class comment. Not a credential.
          ...(options.actorId !== undefined ? { 'X-Actor-Id': options.actorId } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw errorFromStatus(response.status, await readDetail(response));
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (thrown) {
      throw toApiError(thrown);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * FastAPI puts the reason in `detail`, which may be a string or a list of
 * validation objects. Either way it is for the log, not for a seller.
 */
async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    if (body.detail !== undefined) return JSON.stringify(body.detail);
    return undefined;
  } catch {
    return undefined;
  }
}
