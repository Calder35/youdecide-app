import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';

/**
 * Plays one spoken reply, and resolves when it has finished.
 *
 * The first version of this called `play()` the instant the player was created
 * and then waited forever for `didJustFinish`. Two ways that goes wrong on a
 * real phone:
 *
 *   1. A player that is not loaded yet ignores `play()`. Nothing ever finishes,
 *      so the turn sits in "Speaking…" indefinitely with no sound.
 *   2. There was no timeout anywhere, so any missed event was permanent.
 *
 * This version waits for the file to load, then plays, and gives up loudly
 * rather than silently. A reply that cannot be spoken is a small failure; a
 * conversation frozen mid-turn is not.
 */

/** A local file should load almost instantly. If it has not, something is wrong. */
const LOAD_TIMEOUT_MS = 10_000;

/** Hard ceiling on a single reply, in case a finish event never arrives. */
const PLAY_TIMEOUT_MS = 180_000;

export async function playSpeech(uri: string): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

  const player = createAudioPlayer({ uri });

  try {
    await waitForLoad(player);
    await playToEnd(player);
  } finally {
    try {
      player.remove();
    } catch {
      // Already released. Nothing to do.
    }
  }
}

/** Resolves once the player reports the file is ready to play. */
function waitForLoad(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.isLoaded) {
        cleanup();
        resolve();
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Audio did not load within ${LOAD_TIMEOUT_MS}ms`));
    }, LOAD_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      subscription.remove();
    }
  });
}

/** Plays, and resolves at the end of the file. */
function playToEnd(player: AudioPlayer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      // `didJustFinish` is the signal. Some platforms also stop reporting
      // `playing` at the very end without it, so a position at or past the
      // duration counts too — a reply that has finished should not hang on a
      // missing flag.
      const reachedEnd =
        status.didJustFinish ||
        (status.duration > 0 && !status.playing && status.currentTime >= status.duration - 0.25);

      if (reachedEnd) settle(resolve);
    });

    const timer = setTimeout(
      () => settle(() => reject(new Error(`Playback did not finish within ${PLAY_TIMEOUT_MS}ms`))),
      PLAY_TIMEOUT_MS,
    );

    function settle(finish: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      finish();
    }

    try {
      player.play();
    } catch (thrown) {
      settle(() => reject(thrown));
    }
  });
}
