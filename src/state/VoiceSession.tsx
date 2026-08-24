import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiClient } from '../api/client';
import {
  BackendVoiceProvider,
  unavailableVoiceProvider,
} from '../voice/backendVoiceProvider';
import { expoFileBridge } from '../voice/expoFileBridge';
import { playSpeech } from '../voice/playSpeech';
import { useMicrophone } from '../voice/useMicrophone';
import { runVoiceTurn, type VoiceTurnStage } from '../voice/voiceTurn';
import type { StopOutcome } from '../voice/useMicrophone';
import { VoiceError, voiceError, type VoiceProvider } from '../voice/types';
import { useChatSession } from './ChatSession';

/**
 * Speaking and listening, layered on top of the existing conversation.
 *
 * ADDITIVE, NOT A REPLACEMENT. Voice sends its transcript through exactly the
 * same `send` the text composer uses, so there is one conversation and one
 * brain. Everything below can fail and the person can still type.
 */

export type VoiceSessionValue = {
  stage: VoiceTurnStage;
  /** Milliseconds recorded so far. Drives the timer while listening. */
  elapsedMs: number;
  /** Live input level in dBFS, or null when not metering. Drives the meter. */
  level: number | null;
  /** True when this build can do voice at all. */
  isAvailable: boolean;
  /** The last voice problem, in the person's language. */
  error: string | null;
  dismissError: () => void;
  startListening: () => Promise<void>;
  stopListeningAndRespond: () => Promise<void>;
  /** True while anything in the voice pipeline is working. */
  isBusy: boolean;
};

const VoiceSessionContext = createContext<VoiceSessionValue | null>(null);

/** Injected in tests; on a device these are the real native bridges. */
export type VoiceDependencies = {
  provider?: VoiceProvider;
  startRecording?: () => Promise<void>;
  stopRecording?: () => Promise<StopOutcome>;
  play?: (uri: string) => Promise<void>;
  measureBytes?: (uri: string) => Promise<number>;
  /** Defaults to console. Tests pass a no-op to keep output readable. */
  log?: (message: string) => void;
};

export function VoiceSessionProvider({
  children,
  client,
  dependencies = {},
}: {
  children: ReactNode;
  client?: ApiClient;
  dependencies?: VoiceDependencies;
}) {
  const chat = useChatSession();
  const [api] = useState(() => client ?? new ApiClient());
  // The real microphone. Tests override it through `dependencies`; on a device
  // this is what actually records.
  const microphone = useMicrophone();
  const [stage, setStage] = useState<VoiceTurnStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const provider = useMemo<VoiceProvider>(() => {
    if (dependencies.provider !== undefined) return dependencies.provider;
    return api.isConnected
      ? new BackendVoiceProvider(api, expoFileBridge)
      : unavailableVoiceProvider;
  }, [api, dependencies.provider]);

  const report = useCallback((thrown: VoiceError) => setError(thrown.personMessage), []);

  const startListening = useCallback(async () => {
    if (!provider.isAvailable) {
      report(voiceError('unavailable'));
      return;
    }
    setError(null);
    try {
      await (dependencies.startRecording ?? microphone.start)();
      setStage('recording');
    } catch (thrown) {
      setStage('idle');
      report(thrown instanceof VoiceError ? thrown : voiceError('recordFailed', thrown));
    }
  }, [provider, dependencies, microphone, report]);

  const stopListeningAndRespond = useCallback(async () => {
    let outcome: StopOutcome;
    try {
      outcome = await (dependencies.stopRecording ?? microphone.stop)();
    } catch (thrown) {
      setStage('idle');
      report(thrown instanceof VoiceError ? thrown : voiceError('recordFailed', thrown));
      return;
    }

    if (!outcome.ok) {
      // Says which of the two actually happened. Reporting both as "I could not
      // hear anything" is what made a broken interaction look like a broken
      // microphone, and sent someone repeating themselves at a dead button.
      setStage('idle');
      report(voiceError(outcome.kind));
      return;
    }

    await runVoiceTurn(outcome.audio, {
      provider,
      onStage: setStage,
      onError: report,
      play: dependencies.play ?? playSpeech,
      measureBytes: dependencies.measureBytes ?? expoFileBridge.sizeOf,
      // Duration and byte count are exactly what we could not see when this
      // was failing on a real phone.
      log: dependencies.log ?? ((message) => console.log(message)),
      // One conversation. The transcript goes through the same path a typed
      // message does, so history, escalation, and errors all behave identically
      // whether someone spoke or typed — and `send` hands back the reply, so
      // speaking it does not depend on reading state that has not committed.
      sendToBrain: (transcript) => chat.send(transcript),
    });
  }, [provider, dependencies, microphone, chat, report]);

  const value = useMemo<VoiceSessionValue>(
    () => ({
      stage,
      elapsedMs: microphone.durationMs,
      level: microphone.metering,
      isAvailable: provider.isAvailable,
      error,
      dismissError: () => setError(null),
      startListening,
      stopListeningAndRespond,
      isBusy: stage !== 'idle' && stage !== 'recording',
    }),
    [stage, microphone, provider, error, startListening, stopListeningAndRespond],
  );

  return <VoiceSessionContext.Provider value={value}>{children}</VoiceSessionContext.Provider>;
}

export function useVoiceSession(): VoiceSessionValue {
  const value = useContext(VoiceSessionContext);
  if (value === null) {
    throw new Error('useVoiceSession must be used inside a VoiceSessionProvider');
  }
  return value;
}
