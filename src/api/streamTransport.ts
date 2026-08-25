import { expoFetchAvailable, streamFetch } from './streamFetch';
import { streamRequest, type StreamCallbacks, type StreamHandle, type StreamRequestOptions } from './streamRequest';

/**
 * Which of the two ways of reading a stream this device can actually use.
 *
 * There are two because neither is universally safe on its own:
 *
 *   expo/fetch   A real `ReadableStream`, which is the right shape for this and
 *                the nicer code. It is a NATIVE module (`ExpoFetchModule`) that
 *                ships inside the `expo` package, so it is in Expo Go — but a
 *                native module is a thing that can be absent, and when it is,
 *                it is absent at runtime rather than at build time.
 *
 *   XMLHttpRequest  Core React Native networking. Cannot go missing. Fiddlier
 *                — see the three silent-failure rules in `streamRequest.ts` —
 *                but proven, and it is what the tests are built on.
 *
 * NOT the global `fetch`, ever: React Native polyfills it with whatwg-fetch,
 * which has no streaming support and would hand back the whole reply at the end
 * without an error to explain the missing second.
 *
 * The choice is made once, here, so nothing above this file has to think about
 * it and the fallback is a decision rather than an accident.
 */

export type StreamTransport = 'expo-fetch' | 'xhr';

/** Which transport this device will use. Exported for the log line. */
export function pickStreamTransport(): StreamTransport {
  return expoFetchAvailable() ? 'expo-fetch' : 'xhr';
}

export function openStream(
  options: StreamRequestOptions,
  callbacks: StreamCallbacks,
  transport: StreamTransport = pickStreamTransport(),
): StreamHandle {
  return transport === 'expo-fetch'
    ? streamFetch(options, callbacks)
    : streamRequest(options, callbacks);
}
