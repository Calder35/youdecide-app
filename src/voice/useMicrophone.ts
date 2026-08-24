import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useRef } from 'react';

import { voiceError, type RecordedAudio } from './types';

/**
 * The microphone, wrapped.
 *
 * Thin on purpose: it starts, it stops, it hands back a file. Everything about
 * what happens to that file lives in `voiceTurn.ts`, where it can be tested.
 *
 * iOS detail worth knowing: recording and playback need different audio modes,
 * and a device left in record mode plays back through the earpiece at a whisper
 * instead of the speaker. `setAudioModeAsync` is called on both transitions for
 * that reason — getting it wrong makes the AI sound like it is mumbling, which
 * for this product would be a particularly bad bug.
 */

/** Matches what the recorder writes on iOS. */
const IOS_MIME = 'audio/m4a';

export type Microphone = {
  isRecording: boolean;
  start: () => Promise<void>;
  /** Resolves with the recording, or null if nothing usable was captured. */
  stop: () => Promise<RecordedAudio | null>;
};

export function useMicrophone(): Microphone {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const startedAtRef = useRef<number | null>(null);

  const start = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw voiceError('permissionDenied');
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      startedAtRef.current = Date.now();
      recorder.record();
    } catch (thrown) {
      startedAtRef.current = null;
      throw voiceError('recordFailed', thrown);
    }
  }, [recorder]);

  const stop = useCallback(async (): Promise<RecordedAudio | null> => {
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;

    try {
      await recorder.stop();
    } catch (thrown) {
      throw voiceError('recordFailed', thrown);
    }

    // Back to playback mode before anything tries to speak.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    const uri = recorder.uri;
    if (uri === null || startedAt === null) return null;

    return {
      uri,
      durationMs: Date.now() - startedAt,
      mimeType: IOS_MIME,
    };
  }, [recorder]);

  return { isRecording: state.isRecording, start, stop };
}
