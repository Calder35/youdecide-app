import { NETWORK_ERROR, TIMEOUT_ERROR, errorFromStatus } from './errors';

/**
 * Reading an HTTP response AS IT ARRIVES, on React Native.
 *
 * ─── WHY THIS IS NOT `fetch` ────────────────────────────────────────────────
 *
 * Every guide to consuming a streamed endpoint says the same thing:
 *
 *     const response = await fetch(url, ...);
 *     const reader = response.body.getReader();   // ← does not exist here
 *
 * `response.body` IS NOT A STREAM IN REACT NATIVE. RN polyfills `fetch` with
 * whatwg-fetch (3.6.20 in RN 0.81), which is built on XMLHttpRequest and has no
 * `ReadableStream` support at all — the string does not appear anywhere in its
 * source. Its `onreadystatechange` handler acts only on `readyState === 4`, so
 * the promise resolves once, with the entire body.
 *
 * That failure mode is the dangerous kind: it does not throw. Point the naive
 * fetch-and-read-the-stream code at a perfectly good streaming endpoint and it
 * works — it just hands you the whole reply at the end, having waited for all
 * of it, and every millisecond the streaming was supposed to save is gone with
 * nothing on fire to explain why.
 *
 * `EventSource` is not an option either: React Native does not polyfill it, so
 * `new EventSource(...)` is a ReferenceError.
 *
 * ─── WHAT DOES WORK ─────────────────────────────────────────────────────────
 *
 * XMLHttpRequest, directly. RN's native networking emits a
 * `didReceiveNetworkIncrementalData` event and the JS side appends each piece
 * to `responseText`, bumping `readyState` to LOADING (3) every time. That is a
 * real stream, and it needs no new dependency — which is what keeps this
 * working inside Expo Go, where we cannot add native code.
 *
 * THREE RULES, all of which fail silently if broken:
 *
 *   1. THE HANDLER MUST BE ATTACHED BEFORE `send()`. RN computes
 *      `incrementalEvents = _incrementalEvents || !!onreadystatechange ||
 *      !!onprogress` inside `send()` and passes it to the native layer as a
 *      flag on the request. Attach the listener one line too late and the
 *      native side never sends incremental events — you get one delivery at the
 *      end, exactly like fetch, with no error.
 *
 *   2. `responseType` MUST STAY `''` OR `'text'`. `responseText` throws for any
 *      other type.
 *
 *   3. `responseText` ACCUMULATES. It is the whole response so far, not the
 *      latest piece, so the reader has to remember how much it has consumed and
 *      slice from there. Treating it as the new piece replays the whole reply
 *      on every event.
 *
 * ─── THE OTHER HALF IS THE SERVER'S ─────────────────────────────────────────
 *
 * None of this helps if the response is buffered before it reaches us. Gzip
 * middleware, a reverse proxy, or a CDN will happily hold a "stream" until it
 * is complete and hand it over in one piece, and the app cannot tell the
 * difference. The endpoint has to disable compression for this route and, if it
 * sits behind nginx, set `X-Accel-Buffering: no`.
 */

/** Stops an in-flight stream. Safe to call more than once. */
export type StreamHandle = { cancel: () => void };

export type StreamCallbacks = {
  /** The NEW text since the last call. Never the whole response. */
  onChunk: (text: string) => void;
  /** Everything arrived and the status was a success. */
  onDone: () => void;
  onError: (error: unknown) => void;
};

export type StreamRequestOptions = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  /**
   * How long to wait WITHOUT NEW DATA before giving up.
   *
   * Idle, not total, on purpose. A total timeout is the wrong shape for a
   * stream: a long reply that is arriving perfectly well would be cut off for
   * taking too long, while a stream that died after one sentence would sit
   * there until the clock ran out. What matters is whether anything is still
   * coming.
   */
  idleTimeoutMs?: number;
  /** Injected in tests. Defaults to the global XMLHttpRequest. */
  xhrFactory?: () => XMLHttpRequest;
};

export const STREAM_IDLE_TIMEOUT_MS = 20_000;

export function streamRequest(
  options: StreamRequestOptions,
  callbacks: StreamCallbacks,
): StreamHandle {
  const {
    url,
    method = 'POST',
    headers = {},
    body,
    idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
    xhrFactory,
  } = options;

  const xhr = xhrFactory !== undefined ? xhrFactory() : new XMLHttpRequest();

  /** How much of `responseText` has already been handed to the caller. */
  let consumed = 0;
  let settled = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = (run: () => void) => {
    if (settled) return;
    settled = true;
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
    run();
  };

  const armIdleTimer = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      finish(() => {
        try {
          xhr.abort();
        } catch {
          // Already finished. Nothing to abort.
        }
        callbacks.onError(TIMEOUT_ERROR());
      });
    }, idleTimeoutMs);
  };

  /** Hands over whatever is new, and only what is new. See rule 3 above. */
  const drain = () => {
    let text: string;
    try {
      text = xhr.responseText ?? '';
    } catch {
      // `responseText` throws if something set an incompatible responseType.
      // Nothing to read; the completion handler will report the outcome.
      return;
    }
    if (text.length <= consumed) return;
    const fresh = text.slice(consumed);
    consumed = text.length;
    armIdleTimer();
    callbacks.onChunk(fresh);
  };

  // RULE 1. This assignment has to happen before `send()`, or the native layer
  // is never told to deliver incrementally and the whole point is lost.
  xhr.onreadystatechange = () => {
    if (settled) return;

    if (xhr.readyState === 3 /* LOADING */) {
      // Status is available from readyState 2 onward. A failing response still
      // has a body, and draining it as though it were data would feed error
      // JSON into the parser as if it were content.
      if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) return;
      drain();
      return;
    }

    if (xhr.readyState === 4 /* DONE */) {
      const status = xhr.status;
      // A status of 0 after DONE means the transport failed or was aborted —
      // there is no HTTP status to report, so it is a network error.
      if (status === 0) {
        finish(() => callbacks.onError(NETWORK_ERROR('the connection dropped mid-reply')));
        return;
      }
      if (status < 200 || status >= 300) {
        let detail: string | undefined;
        try {
          detail = xhr.responseText?.slice(0, 300);
        } catch {
          detail = undefined;
        }
        finish(() => callbacks.onError(errorFromStatus(status, detail)));
        return;
      }
      // Anything the LOADING events did not cover — including the whole body,
      // if this response turned out not to be streamed after all.
      drain();
      finish(() => callbacks.onDone());
    }
  };

  try {
    xhr.open(method, url);
    // RULE 2. Left as the default '' so `responseText` stays readable.
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    armIdleTimer();
    xhr.send(body === undefined ? undefined : JSON.stringify(body));
  } catch (thrown) {
    finish(() => callbacks.onError(NETWORK_ERROR(String(thrown))));
  }

  return {
    cancel: () => {
      finish(() => {
        try {
          xhr.abort();
        } catch {
          // Already done.
        }
      });
    },
  };
}
