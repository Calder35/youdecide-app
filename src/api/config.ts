/**
 * Where the app is allowed to send anything.
 *
 * The non-negotiable this file exists for: **no production side effects**. The
 * app ships pointing at nothing, and the only hosts it will talk to are ones
 * that are obviously not production. A misconfigured build fails loudly at
 * startup instead of quietly writing to a real system.
 *
 * Configure with `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`). Leave it
 * unset and the app runs exactly as it did in chunk 2 — mock data, no network.
 */

/** Read from the Expo public env at build time. Unset means offline. */
const RAW_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

/**
 * Hosts we accept. Loopback and private-LAN addresses cover a laptop and a
 * phone on the same wifi running Expo Go; the `test.`/`dev.`/`staging.`
 * prefixes cover a shared review deployment.
 *
 * Everything else is refused. Adding a host here is a deliberate act that shows
 * up in a diff — which is the point.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const TEST_PREFIXES = ['test.', 'dev.', 'staging.', 'localhost.'];

function isPrivateLan(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const [a, b] = parts.map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function isTestHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK.has(host)) return true;
  if (host.endsWith('.local')) return true;
  if (isPrivateLan(host)) return true;
  return TEST_PREFIXES.some((prefix) => host.startsWith(prefix));
}

export class ProductionHostRefused extends Error {
  constructor(url: string) {
    super(
      `Refusing to use "${url}". This build only talks to test hosts — localhost, a private LAN address, a .local name, or a test./dev./staging. hostname. ` +
        'This app has no production mode: if you need one, that is a deliberate change with a review, not a config value.',
    );
    this.name = 'ProductionHostRefused';
  }
}

/**
 * Validates a base URL, throwing on anything that could be production.
 * Exported so the guard itself is testable rather than only reachable at boot.
 */
export function assertTestBaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProductionHostRefused(url);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ProductionHostRefused(url);
  }
  if (!isTestHost(parsed.hostname)) {
    throw new ProductionHostRefused(url);
  }
  // Normalize: no trailing slash, so path joining is boring.
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

export type ApiMode = 'offline' | 'test-api';

export type ApiConfig = {
  mode: ApiMode;
  /** Empty in offline mode. */
  baseUrl: string;
};

/**
 * Resolve the configuration. Never throws for the common case (unset → offline);
 * throws only when someone has explicitly pointed the app somewhere it must
 * not go.
 */
export function resolveApiConfig(rawUrl: string = RAW_BASE_URL): ApiConfig {
  if (rawUrl.length === 0) {
    return { mode: 'offline', baseUrl: '' };
  }
  return { mode: 'test-api', baseUrl: assertTestBaseUrl(rawUrl) };
}

/**
 * The consent scope the backend's workspace gate requires. Must match
 * `SELLER_INTAKE_SCOPE` in the backend's `app/config.py` — if the two drift, a
 * workspace request is refused with a 403 and no seller can get past discovery.
 */
export const SELLER_INTAKE_SCOPE = 'seller_intake';

/** How long any single request may take before we stop waiting. */
export const REQUEST_TIMEOUT_MS = 10_000;
