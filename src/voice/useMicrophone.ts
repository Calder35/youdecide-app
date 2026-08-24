import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useRef } from 'react';

import { MIN_AUDIO_BYTES, voiceError, type RecordedAudio } from './types';

/**
 * The microphone.
 *
 * WHAT WENT WRONG BEFORE, because it is the reason this file looks like it
 * does. The mic was press-and-hold: `onPressIn` called `start()`, `onPressOut`
 * called `stop()`. But `start()` has to await a permission check, an audio-mode
 * change, and `prepareToRecordAsync()` — tens of milliseconds at best, and on
 * the very first use it awaits a permission DIALOG, which cancels the touch and
 * fires `onPressOut` immediately.
 *
 * So a tap called `stop()` while `start()` was still awaiting. Nothing had begun
 * recording, `stop()` returned null, and the caller reported that as "I could
 * not hear anything in that." The microphone was fine. The interaction was
 * impossible to perform.
 *
 * Two things stop that recurring:
 *   1. The caller is now tap-to-start / tap-to-stop, so there is no race to
 *      lose (see `MicButton`).
 *   2. `stop()` AWAITS THE PENDING START regardless. Even if a caller manages to
 *      stop early, it waits for recording to actually begin rather than
 *      reporting a phantom silence.
 */

/** Recorder state is polled this often — fast enough for a live level meter. */
const STATE_POLL_MS = 100;

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

export type StopOutcome =
  | { ok: true; audio: RecordedAudio }
  | { ok: false; kind: 'didNotStart' | 'silent' };

export type Microphone = {
  isRecording: boolean;
  /** Milliseconds so far, straight from the recorder. Drives the timer. */
  durationMs: number;
  /** Live input level, roughly -160 (silence) to 0 (loud). Drives the meter. */
  metering: number | null;
  /** Asks for permission, prompting if we are allowed to. */
  ensurePermission: () => Promise<PermissionOutcome>;
  start: () => Promise<void>;
  stop: () => Promise<StopOutcome>;
};

export function useMicrophone(): Microphone {
  // Metering on: without it there is no way to show a person that the mic is
  // actually hearing them, which is exactly the reassurance missing before.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, STATE_POLL_MS);

  /** Resolves when `start()` has genuinely begun recording. */
  const pendingStartRef = useRef<Promise<void> | null>(null);
  const startedRef = useRef(false);

  const ensurePermission = useCallback(async (): Promise<PermissionOutcome> => {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) return 'granted';

    // `canAskAgain: false` means iOS will not show the dialog again — only
    // Settings can fix it. Telling those two apart is the difference between
    // "tap again and choose Allow" and "go to Settings", and getting it wrong
    // sends someone tapping a button that can never work.
    if (!current.canAskAgain) return 'blocked';

    const asked = await AudioModule.requestRecordingPermissionsAsync();
    if (asked.granted) return 'granted';
    return asked.canAskAgain ? 'denied' : 'blocked';
  }, []);

  const start = useCallback(async () => {
    const begin = (async () => {
      const outcome = await ensurePermission();
      if (outcome === 'blocked') throw voiceError('permissionBlocked');
      if (outcome === 'denied') throw voiceError('permissionDenied');

      try {
        // Mode before prepare: iOS will not open an input on a session that is
        // still configured for playback.
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        startedRef.current = true;
      } catch (thrown) {
        startedRef.current = false;
        throw voiceError('recordFailed', thrown);
      }
    })();

    pendingStartRef.current = begin.catch(() => undefined);
    await begin;
  }, [ensurePermission, recorder]);

  const stop = useCallback(async (): Promise<StopOutcome> => {
    // The fix for the original bug: never stop a recording that has not
    // started. Wait for the start we already kicked off.
    if (pendingStartRef.current !== null) {
      await pendingStartRef.current;
      pendingStartRef.current = null;
    }

    if (!startedRef.current) {
      return { ok: false, kind: 'didNotStart' };
    }
    startedRef.current = false;

    // Read the duration BEFORE stopping — the recorder zeroes it afterwards.
    const durationMs = recorder.getStatus().durationMillis;

    try {
      await recorder.stop();
    } catch (thrown) {
      throw voiceError('recordFailed', thrown);
    }

    // Back to playback mode before anything tries to speak.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    const uri = recorder.uri;
    if (uri === null) return { ok: false, kind: 'silent' };

    return {
      ok: true,
      audio: { uri, durationMs, mimeType: mimeTypeFor(uri) },
    };
  }, [recorder]);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    metering: state.metering ?? null,
    ensurePermission,
    start,
    stop,
  };
}

/**
 * What the recorder actually wrote, from the file it wrote it to.
 *
 * Previously hard-coded to `audio/m4a`. That happened to be right on iOS with
 * the high-quality preset and wrong everywhere else — the kind of assumption
 * that works until the day it does not.
 */
export function mimeTypeFor(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'm4a':
    case 'mp4':
    case 'aac':
      return 'audio/m4a';
    case 'wav':
      return 'audio/wav';
    case 'caf':
      return 'audio/x-caf';
    case 'webm':
      return 'audio/webm';
    case '3gp':
      return 'audio/3gpp';
    default:
      // The backend falls back to m4a for anything it does not recognise, and
      // that is what expo-audio writes on both platforms we ship to.
      return 'audio/m4a';
  }
}

export { MIN_AUDIO_BYTES };
