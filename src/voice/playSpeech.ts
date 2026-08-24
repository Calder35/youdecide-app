import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Plays one spoken reply, and resolves when it has finished.
 *
 * A plain function rather than a hook: the turn machine awaits it as a step,
 * and hooks cannot be awaited. It creates a player per reply and releases it
 * afterwards — these are short one-shot files, and holding a player open per
 * turn would leak one for every thing the AI ever said.
 */
export async function playSpeech(uri: string): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

  const player = createAudioPlayer({ uri });

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          finish();
        }
      });

      try {
        player.play();
      } catch (thrown) {
        subscription.remove();
        settled = true;
        reject(thrown);
      }
    });
  } finally {
    try {
      player.remove();
    } catch {
      // Already released. Nothing to do.
    }
  }
}
