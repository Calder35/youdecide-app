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
  stopRecording?: () => Promise<Parameters<typeof runVoiceTurn>[0] | null>;
  play?: (uri: string) => Promise<void>;
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
    let audio;
    try {
      audio = await (dependencies.stopRecording ?? microphone.stop)();
    } catch (thrown) {
      setStage('idle');
      report(thrown instanceof VoiceError ? thrown : voiceError('recordFailed', thrown));
      return;
    }

    if (audio === null) {
      setStage('idle');
      report(voiceError('noSpeech'));
      return;
    }

    await runVoiceTurn(audio, {
      provider,
      onStage: setStage,
      onError: report,
      play: dependencies.play ?? playSpeech,
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
      isAvailable: provider.isAvailable,
      error,
      dismissError: () => setError(null),
      startListening,
      stopListeningAndRespond,
      isBusy: stage !== 'idle' && stage !== 'recording',
    }),
    [stage, provider, error, startListening, stopListeningAndRespond],
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
