import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiClient } from '../api/client';
import {
  BackendVoiceProvider,
  unavailableVoiceProvider,
} from '../voice/backendVoiceProvider';
import {
  DEFAULT_ENDPOINT_CONFIG,
  describeLevels,
  newEndpointState,
  observeLevel,
  type EndpointConfig,
} from '../voice/endpointing';
import { expoFileBridge } from '../voice/expoFileBridge';
import { playSpeech } from '../voice/playSpeech';
import { useMicrophone, type MicSample, type StopOutcome } from '../voice/useMicrophone';
import { runVoiceTurn, type VoiceTurnStage, type VoiceTurnTiming } from '../voice/voiceTurn';
import { VoiceError, voiceError, type VoiceProvider } from '../voice/types';
import { useChatSession } from './ChatSession';

/**
 * Speaking and listening, layered on top of the existing conversation.
 *
 * ADDITIVE, NOT A REPLACEMENT. Voice sends its transcript through exactly the
 * same `send` the text composer uses, so there is one conversation and one
 * brain. Everything below can fail and the person can still type.
 *
 * ─── CONVERSATION MODE ──────────────────────────────────────────────────────
 *
 * The interaction this file exists to provide: press once, then talk.
 *
 *   listen → they stop → send → speak the reply → listen again
 *
 * with no tap between turns. The old shape asked for a tap to start and a tap
 * to stop on EVERY turn, which is fine for dictation and wrong for a
 * conversation — nobody thinks out loud with a finger hovering over a button.
 *
 * The end of a turn is detected from the input level (see `endpointing.ts`),
 * sampled straight off the recorder on a timer rather than through React state,
 * so the decision is not paced by the render loop.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: listen while it is speaking. Without echo
 * cancellation the mic hears the reply and answers itself, and expo-audio
 * offers no way to cancel that inside Expo Go. So there is no barge-in — the
 * loop listens only between replies. Interrupting means tapping End: one tap
 * for something people do rarely, instead of a mode that talks over itself
 * constantly.
 */

/** How often the listening loop reads the input level. */
const SAMPLE_INTERVAL_MS = 100;

export type VoiceSessionValue = {
  stage: VoiceTurnStage;
  /**
   * True while a hands-free conversation is running: it listens, sends when you
   * stop talking, speaks, and listens again, with no tapping between turns.
   */
  inConversation: boolean;
  /**
   * False once we know this device will not report the input levels hands-free
   * is built on. The mic falls back to tap-to-start, tap-to-send.
   */
  handsFreeAvailable: boolean;
  /** Enter hands-free conversation. */
  startConversation: () => Promise<void>;
  /** Leave it. The written conversation stays exactly as it is. */
  endConversation: () => Promise<void>;
  /** Milliseconds recorded so far. Drives the timer while listening. */
  elapsedMs: number;
  /** Live input level in dBFS, or null when not metering. Drives the meter. */
  level: number | null;
  /** True when this build can do voice at all. */
  isAvailable: boolean;
  /** The last voice problem, in the person's language. */
  error: string | null;
  dismissError: () => void;
  /** One turn, by hand. Still here: it is the fallback, and it is the tap-to-send. */
  startListening: () => Promise<void>;
  stopListeningAndRespond: () => Promise<void>;
  /** True while anything in the voice pipeline is working. */
  isBusy: boolean;
  /** Where the last turn's seconds went. Null until a turn has been spoken. */
  lastTiming: VoiceTurnTiming | null;
};

const VoiceSessionContext = createContext<VoiceSessionValue | null>(null);

/** Injected in tests; on a device these are the real native bridges. */
export type VoiceDependencies = {
  provider?: VoiceProvider;
  startRecording?: () => Promise<void>;
  stopRecording?: () => Promise<StopOutcome>;
  /** The live input level, read on the listening loop's own timer. */
  sample?: () => MicSample;
  play?: (uri: string) => Promise<void>;
  measureBytes?: (uri: string) => Promise<number>;
  /** Defaults to console. Tests pass a no-op to keep output readable. */
  log?: (message: string) => void;
  /** Endpointing thresholds. Tests shrink the timings to keep runs fast. */
  endpointConfig?: Partial<EndpointConfig>;
  /** Overrides the sampling cadence, so a test does not wait in real time. */
  sampleIntervalMs?: number;
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
  // The real microphone. Tests override its parts through `dependencies`; on a
  // device this is what actually records.
  const microphone = useMicrophone();
  const [stage, setStage] = useState<VoiceTurnStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inConversation, setInConversation] = useState(false);
  const [handsFreeAvailable, setHandsFreeAvailable] = useState(true);
  const [lastTiming, setLastTiming] = useState<VoiceTurnTiming | null>(null);

  const endpointConfig = useMemo<EndpointConfig>(
    () => ({ ...DEFAULT_ENDPOINT_CONFIG, ...dependencies.endpointConfig }),
    [dependencies.endpointConfig],
  );

  /**
   * Refs rather than state, because the listening loop reads them from inside a
   * timer. State would hand that timer whatever was true when it was created.
   */
  const conversationRef = useRef(false);
  const endpointRef = useRef(newEndpointState(endpointConfig));
  const turnBusyRef = useRef(false);

  const provider = useMemo<VoiceProvider>(() => {
    if (dependencies.provider !== undefined) return dependencies.provider;
    return api.isConnected
      ? new BackendVoiceProvider(api, expoFileBridge)
      : unavailableVoiceProvider;
  }, [api, dependencies.provider]);

  const log = useMemo(
    () => dependencies.log ?? ((message: string) => console.log(message)),
    [dependencies.log],
  );

  const report = useCallback(
    (thrown: VoiceError) => {
      // Logged as well as shown. When someone reports "it failed instantly",
      // the kind is the whole answer — and last time we had to infer it.
      log(`voice: ${thrown.kind} — ${thrown.personMessage}`);
      setError(thrown.personMessage);
    },
    [log],
  );

  const startRecording = dependencies.startRecording ?? microphone.start;
  const stopRecording = dependencies.stopRecording ?? microphone.stop;
  const sample = dependencies.sample ?? microphone.sample;

  /**
   * Opens the microphone.
   *
   * `clearError` is false when the LOOP reopens it between turns, and that
   * distinction is not cosmetic. A person tapping the mic has decided to try
   * again, so clearing the last complaint is right. The loop reopening the mic
   * a moment after "I could not read that reply out loud" has decided nothing —
   * wiping the message there means the only notice they get is erased before
   * they can read it.
   */
  const beginListening = useCallback(
    async (clearError: boolean) => {
      if (!provider.isAvailable) {
        report(voiceError('unavailable'));
        return;
      }
      if (clearError) setError(null);
      endpointRef.current = newEndpointState(endpointConfig);
      try {
        await startRecording();
        setStage('recording');
      } catch (thrown) {
        setStage('idle');
        // A microphone that will not open ends the conversation rather than
        // looping on the same failure. A repeating error is worse than one.
        conversationRef.current = false;
        setInConversation(false);
        report(thrown instanceof VoiceError ? thrown : voiceError('recordFailed', thrown));
      }
    },
    [provider, startRecording, report, endpointConfig],
  );

  const startListening = useCallback(() => beginListening(true), [beginListening]);

  const stopListeningAndRespond = useCallback(async () => {
    let outcome: StopOutcome;
    try {
      outcome = await stopRecording();
    } catch (thrown) {
      setStage('idle');
      report(thrown instanceof VoiceError ? thrown : voiceError('recordFailed', thrown));
      return;
    }

    if (!outcome.ok) {
      setStage('idle');
      // In a hands-free conversation an empty capture is not a failure — it is
      // a pause. A red warning every time someone thinks for a moment would
      // make the mode unusable; the loop simply listens again.
      if (conversationRef.current) {
        log(`voice: empty capture (${outcome.kind}) — listening again`);
        return;
      }
      // Says which of the two actually happened. Reporting both as "I could not
      // hear anything" is what made a broken interaction look like a broken
      // microphone, and sent someone repeating themselves at a dead button.
      report(voiceError(outcome.kind));
      return;
    }

    await runVoiceTurn(outcome.audio, {
      provider,
      onStage: setStage,
      onError: (thrown) => {
        // Mid-conversation, "I could not make out any words" is a pause and not
        // a problem — the same judgement as the empty capture above.
        if (conversationRef.current && thrown.kind === 'noSpeech') {
          log('voice: nothing recognisable in that turn — listening again');
          return;
        }
        report(thrown);
      },
      // Playback waits here for the audio session to finish switching out of
      // recording. That switch was started when the mic stopped, several
      // seconds ago, so this resolves instantly — which is the entire point of
      // not having awaited it back then.
      play: async (uri: string) => {
        await microphone.readyForPlayback();
        await (dependencies.play ?? playSpeech)(uri);
      },
      measureBytes: dependencies.measureBytes ?? expoFileBridge.sizeOf,
      // Duration and byte count are exactly what we could not see when this was
      // failing on a real phone.
      log,
      onTiming: setLastTiming,
      // One conversation. The transcript goes through the same path a typed
      // message does, so history, escalation, and errors all behave identically
      // whether someone spoke or typed — and `send` hands back the reply, so
      // speaking it does not depend on reading state that has not committed.
      //
      // `mode: 'voice'` is the one difference: it tells the backend this turn
      // will be LISTENED to, so it can answer in a sentence or two instead of
      // the paragraphs that read well but take thirteen seconds to say.
      sendToBrain: (transcript) => chat.send(transcript, { mode: 'voice' }),
      // AND, when the backend can stream it, the same turn delivered a sentence
      // at a time so speaking can start before the reply is finished. Voice
      // only: it buys time-to-first-SOUND, and typed chat has no equivalent to
      // gain. Absent, everything below behaves exactly as it did before.
      streamToBrain: chat.streamingAvailable
        ? (transcript, onSentence) =>
            chat.sendStreaming(transcript, { mode: 'voice', onSentence })
        : undefined,
    });
  }, [provider, dependencies, microphone, stopRecording, chat, report, log]);

  /** Ends the recording and throws it away. Used when nothing was said. */
  const discardRecording = useCallback(async () => {
    try {
      await stopRecording();
    } catch {
      // Nothing to salvage and nothing worth saying about it.
    }
    setStage('idle');
  }, [stopRecording]);

  /**
   * ONE TURN OF THE HANDS-FREE LOOP: send what was heard, speak, listen again.
   *
   * `turnBusyRef` is what keeps this a loop rather than a pile-up: without it a
   * timer tick arriving mid-turn could start a second turn on top of the first.
   */
  const runConversationTurn = useCallback(
    async (send: boolean) => {
      if (turnBusyRef.current) return;
      turnBusyRef.current = true;
      try {
        if (send) {
          await stopListeningAndRespond();
        } else {
          await discardRecording();
        }
        // Only carry on if they have not left in the meantime. Checking AFTER
        // the await is the point: ending mid-reply must not reopen the mic.
        if (conversationRef.current) {
          await beginListening(false);
        }
      } finally {
        turnBusyRef.current = false;
      }
    },
    [stopListeningAndRespond, discardRecording, beginListening],
  );

  /**
   * Hands-free is impossible without levels. Say so, and fall back honestly.
   *
   * The recording in progress is SENT, not binned. By the time this fires the
   * person has been talking at an open mic for a second and a half, and the
   * rule this whole layer is built on is that a voice failure never costs
   * someone their words. They get an answer to what they said, and a mic that
   * from now on tells them plainly to tap when they are done.
   */
  const dropToTapToTalk = useCallback(async () => {
    log('voice: the recorder reports no input levels — hands-free is not possible here');
    conversationRef.current = false;
    setInConversation(false);
    setHandsFreeAvailable(false);
    await stopListeningAndRespond();
    // Explained afterwards, and only if that turn had nothing more specific to
    // say. "The recording had not started" tells someone what to do next;
    // burying it under a note about metering would not.
    setError(
      (current) =>
        current ??
        'This phone is not reporting microphone levels, so I cannot tell when you have finished. ' +
          'Tap the mic to start, then tap again to send.',
    );
  }, [log, stopListeningAndRespond]);

  /** One reading of the input, and what it means. */
  const tick = useCallback(() => {
    if (!conversationRef.current || turnBusyRef.current) return;

    const reading = sample();
    const { state, decision } = observeLevel(
      endpointRef.current,
      reading.level,
      reading.durationMs,
      endpointConfig,
    );
    endpointRef.current = state;

    if (decision === 'listening') return;

    if (decision === 'noMetering') {
      void dropToTapToTalk();
      return;
    }

    log(
      `voice: ${decision} at ${Math.round(reading.durationMs)}ms — ` +
        describeLevels(state, endpointConfig),
    );
    // `noSpeech` means the mic was open and nobody said anything. That is not
    // worth a request and it is certainly not worth an error — it is someone
    // thinking. Start a fresh recording and keep waiting.
    void runConversationTurn(decision === 'endpoint');
  }, [sample, endpointConfig, log, dropToTapToTalk, runConversationTurn]);

  /**
   * The tick is held in a ref and refreshed every render so the interval below
   * can depend on nothing but "are we listening".
   *
   * THIS MATTERS MORE THAN IT LOOKS. The recorder re-renders this tree roughly
   * every 100ms, which is also how often the loop wants to sample. An interval
   * that restarted whenever a callback identity changed would be cleared and
   * recreated on every one of those renders and might never fire at all.
   */
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!inConversation || stage !== 'recording') return;
    const interval = setInterval(
      () => tickRef.current(),
      dependencies.sampleIntervalMs ?? SAMPLE_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [inConversation, stage, dependencies.sampleIntervalMs]);

  const startConversation = useCallback(async () => {
    if (!provider.isAvailable) {
      report(voiceError('unavailable'));
      return;
    }
    // Open the connection while they are still drawing breath, so the first
    // turn does not also pay for a TLS handshake.
    void api.warmUp();
    conversationRef.current = true;
    setInConversation(true);
    await startListening();
  }, [provider, api, report, startListening]);

  const endConversation = useCallback(async () => {
    conversationRef.current = false;
    setInConversation(false);
    // Stop a recording in progress WITHOUT sending it: someone leaving the mode
    // is not submitting a turn, and shipping their half-sentence would be a
    // surprise. A turn already in flight is left to finish — those words are
    // already gone, and swallowing the answer to them would be worse.
    if (stage === 'recording') {
      await discardRecording();
    }
  }, [stage, discardRecording]);

  /** Leaving the screen must not leave a loop running behind it. */
  useEffect(() => {
    return () => {
      conversationRef.current = false;
    };
  }, []);

  const value = useMemo<VoiceSessionValue>(
    () => ({
      stage,
      inConversation,
      handsFreeAvailable,
      startConversation,
      endConversation,
      elapsedMs: microphone.durationMs,
      level: microphone.metering,
      isAvailable: provider.isAvailable,
      error,
      dismissError: () => setError(null),
      startListening,
      stopListeningAndRespond,
      isBusy: stage !== 'idle' && stage !== 'recording',
      lastTiming,
    }),
    [
      stage,
      inConversation,
      handsFreeAvailable,
      startConversation,
      endConversation,
      microphone,
      provider,
      error,
      startListening,
      stopListeningAndRespond,
      lastTiming,
    ],
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
