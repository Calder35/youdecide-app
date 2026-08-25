import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
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

/**
 * How this app records: one channel, 22 kHz, 32 kbps AAC.
 *
 * NOT `RecordingPresets.HIGH_QUALITY`, which is 44.1 kHz STEREO at 128 kbps —
 * studio settings for a job that is one person talking into a phone. Measured on
 * the same eight-second utterance:
 *
 *   HIGH_QUALITY   135 KB on disk → 180 KB of base64 to upload
 *   this preset     39 KB on disk →  52 KB of base64 to upload
 *
 * The transcript came back CHARACTER-IDENTICAL from the live endpoint. Speech
 * recognition resamples to 16 kHz mono internally regardless, so the extra
 * 128 KB buys nothing and costs upload time on every single turn — which on a
 * phone's upstream is the part of transcription a person actually waits for.
 */
const SPEECH_RECORDING: RecordingOptions = {
  isMeteringEnabled: true,
  extension: '.m4a',
  sampleRate: 22_050,
  numberOfChannels: 1,
  bitRate: 32_000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32_000 },
};

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

export type StopOutcome =
  | { ok: true; audio: RecordedAudio }
  | { ok: false; kind: 'didNotStart' | 'silent' };

/** One reading of the live input, taken straight off the recorder. */
export type MicSample = {
  /** dBFS, or null when the recorder is not reporting a level. */
  level: number | null;
  durationMs: number;
  isRecording: boolean;
};

export type Microphone = {
  isRecording: boolean;
  /** Milliseconds so far, straight from the recorder. Drives the timer. */
  durationMs: number;
  /** Live input level, roughly -160 (silence) to 0 (loud). Drives the meter. */
  metering: number | null;
  /**
   * The same numbers, read SYNCHRONOUSLY and without a re-render.
   *
   * Endpointing runs off this rather than off `metering`, because deciding when
   * someone stopped talking should not be paced by React's render loop. It also
   * lets the listening loop sample faster than the state poll when it wants to.
   */
  sample: () => MicSample;
  /** Asks for permission, prompting if we are allowed to. */
  ensurePermission: () => Promise<PermissionOutcome>;
  start: () => Promise<void>;
  stop: () => Promise<StopOutcome>;
  /**
   * Resolves once the audio session is back in playback mode.
   *
   * `stop()` starts that switch but does not wait for it, so transcription can
   * begin immediately. Anything about to play audio awaits this first.
   */
  readyForPlayback: () => Promise<void>;
};

export function useMicrophone(): Microphone {
  // Metering on: without it there is no way to show a person that the mic is
  // actually hearing them, and — since this app decides for itself when someone
  // has finished speaking — no way to hear the end of a turn either.
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const state = useAudioRecorderState(recorder, STATE_POLL_MS);

  /** Resolves when `start()` has genuinely begun recording. */
  const pendingStartRef = useRef<Promise<void> | null>(null);
  const startedRef = useRef(false);
  /** The audio-mode switch back to playback, once `stop()` has kicked it off. */
  const playbackModeRef = useRef<Promise<void> | null>(null);

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
        playbackModeRef.current = null;
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

    // Back to playback mode before anything tries to speak — but NOT awaited
    // here. This used to sit between the person finishing their sentence and
    // the upload starting, for no reason: nothing plays for another few seconds
    // while speech is transcribed and the reply is written. `readyForPlayback()`
    // is where that wait belongs, and by then it has long since finished.
    playbackModeRef.current = setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    const uri = recorder.uri;
    if (uri === null) return { ok: false, kind: 'silent' };

    return {
      ok: true,
      audio: { uri, durationMs, mimeType: mimeTypeFor(uri) },
    };
  }, [recorder]);

  const sample = useCallback((): MicSample => {
    try {
      const status = recorder.getStatus();
      return {
        level: typeof status.metering === 'number' ? status.metering : null,
        durationMs: status.durationMillis,
        isRecording: status.isRecording,
      };
    } catch {
      // A recorder mid-teardown can throw here. A missing sample is a sample
      // that says nothing, not a reason to bring down the conversation.
      return { level: null, durationMs: 0, isRecording: false };
    }
  }, [recorder]);

  const readyForPlayback = useCallback(async () => {
    if (playbackModeRef.current === null) {
      // Nothing recorded this turn, so nothing started the switch. Do it now.
      playbackModeRef.current = setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
    try {
      await playbackModeRef.current;
    } catch {
      // The session may already be in playback mode. Try to speak anyway —
      // failing here would turn a maybe into a definitely.
    }
  }, []);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    metering: state.metering ?? null,
    sample,
    ensurePermission,
    start,
    stop,
    readyForPlayback,
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
