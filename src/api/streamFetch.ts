import { NETWORK_ERROR, TIMEOUT_ERROR, errorFromStatus } from './errors';
import type { StreamCallbacks, StreamHandle, StreamRequestOptions } from './streamRequest';

/**
 * Reading a response as it arrives, using `expo/fetch`.
 *
 * ─── WHY NOT THE GLOBAL `fetch` ─────────────────────────────────────────────
 *
 * Because it cannot do this. React Native polyfills the global `fetch` with
 * whatwg-fetch (3.6.20 under RN 0.81), which is built on XMLHttpRequest and has
 * no `ReadableStream` support at all — `response.body` is null and the promise
 * resolves once, with the whole body. The textbook
 * `response.body.getReader()` does not merely fail there; the version somebody
 * writes to work around it silently waits for the entire reply and hands it
 * over at the end, giving back every millisecond streaming was meant to save.
 *
 * `expo/fetch` is a different implementation that ships inside the `expo`
 * package — a native Swift/Kotlin module (`ExpoFetchModule`) with a JS wrapper
 * whose `FetchResponse.body` IS a real `ReadableStream`, fed by native
 * `didReceiveResponseData` events. Because it lives in `expo` itself rather than
 * in a third-party package, it is present in Expo Go, which is the constraint
 * everything here is built around.
 *
 * IT IS STILL NOT ASSUMED TO EXIST. If the native module is missing — an older
 * Expo Go, web, some future repackaging — this reports that it is unavailable
 * and the caller falls back to the XHR transport, which uses core React Native
 * networking and cannot go missing. See `pickStreamTransport`.
 */

/** Bytes to text, incrementally — a multi-byte character can span two chunks. */
function makeDecoder(): (bytes: Uint8Array, last: boolean) => string {
  if (typeof TextDecoder !== 'undefined') {
    const decoder = new TextDecoder();
    return (bytes, last) => decoder.decode(bytes, { stream: !last });
  }
  // Every environment we ship to has TextDecoder. This is here so a missing one
  // degrades to mangled non-ASCII rather than to no reply at all.
  return (bytes) => String.fromCharCode(...bytes);
}

/** True when `expo/fetch` is present and can actually stream here. */
export function expoFetchAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo/fetch') as { fetch?: unknown };
    return typeof module.fetch === 'function';
  } catch {
    return false;
  }
}

export function streamFetch(
  options: StreamRequestOptions,
  callbacks: StreamCallbacks,
): StreamHandle {
  const { url, method = 'POST', headers = {}, body, idleTimeoutMs = 20_000 } = options;

  const controller = new AbortController();
  let settled = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = (run: () => void) => {
    if (settled) return;
    settled = true;
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
    run();
  };

  /**
   * Idle, not total. A long reply that is still arriving is not a stuck one,
   * and a total deadline would cut off exactly the replies worth waiting for.
   */
  const armIdleTimer = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      finish(() => {
        controller.abort();
        callbacks.onError(TIMEOUT_ERROR());
      });
    }, idleTimeoutMs);
  };

  void (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetch: expoFetch } = require('expo/fetch') as { fetch: typeof globalThis.fetch };

    try {
      armIdleTimer();

      const response = await expoFetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        // A pre-stream failure is an ordinary HTTP error: 404 for an unknown
        // conversation, 403 for someone else's, 422 for a mode the backend does
        // not know. Read the body for the detail, then report it as such.
        let detail: string | undefined;
        try {
          detail = (await response.text()).slice(0, 300);
        } catch {
          detail = undefined;
        }
        finish(() => callbacks.onError(errorFromStatus(response.status, detail)));
        return;
      }

      const reader = response.body?.getReader();
      if (reader === undefined) {
        // A body that is not a stream means we are not getting incremental
        // delivery, whatever the headers said. Say so rather than pretending.
        finish(() => callbacks.onError(NETWORK_ERROR('the response could not be read as a stream')));
        return;
      }

      const decode = makeDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (settled) return;

        if (done) {
          const tail = decode(new Uint8Array(), true);
          if (tail.length > 0) callbacks.onChunk(tail);
          finish(() => callbacks.onDone());
          return;
        }

        if (value !== undefined && value.length > 0) {
          armIdleTimer();
          callbacks.onChunk(decode(value, false));
        }
      }
    } catch (thrown) {
      if (settled) return;
      // An abort is our own cancel or idle timeout, both already reported.
      const aborted =
        controller.signal.aborted ||
        (thrown instanceof Error && /abort/i.test(thrown.name + thrown.message));
      if (aborted) {
        finish(() => undefined);
        return;
      }
      finish(() => callbacks.onError(NETWORK_ERROR(String(thrown))));
    }
  })();

  return {
    cancel: () =>
      finish(() => {
        try {
          controller.abort();
        } catch {
          // Already finished.
        }
      }),
  };
}
