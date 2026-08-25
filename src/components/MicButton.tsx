import { Pressable, StyleSheet, View } from 'react-native';

import { useVoiceSession } from '../state/VoiceSession';
import { theme } from '../theme';
import { AppText } from './AppText';

export const MIC_TEST_ID = 'mic-button';
export const VOICE_STAGE_TEST_ID = 'voice-stage';
export const LEVEL_METER_TEST_ID = 'voice-level';

/**
 * One tap starts a conversation. One tap ends it.
 *
 * IN BETWEEN THERE IS NO TAPPING. It listens, notices when you have stopped
 * talking, sends, speaks the reply, and listens again. The point is that a
 * person can put the phone down and talk — the old tap-send-tap-send rhythm
 * made every turn a small piece of admin.
 *
 * (Before that it was press-and-hold, which never worked at all: `onPressIn`
 * began an async start and `onPressOut` stopped a recording that had not begun.
 * Both of those interaction bugs are why this button is now the simplest thing
 * that can work — a toggle.)
 */
export function MicButton() {
  const {
    isAvailable,
    isBusy,
    inConversation,
    startConversation,
    endConversation,
    handsFreeAvailable,
    stage,
    startListening,
    stopListeningAndRespond,
  } = useVoiceSession();


  // When a device reports no input levels we cannot tell when someone has
  // stopped talking, so the same button reverts to the tap-to-send behaviour
  // the fallback message describes. One control, two honest behaviours.
  const recording = stage === 'recording';
  const active = handsFreeAvailable ? inConversation : recording;

  const label = handsFreeAvailable
    ? inConversation
      ? 'End the conversation'
      : 'Start talking'
    : recording
      ? 'Send what you said'
      : 'Tap to speak';

  const onPress = handsFreeAvailable
    ? () => void (inConversation ? endConversation() : startConversation())
    : () => void (recording ? stopListeningAndRespond() : startListening());

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          !isAvailable
            ? 'Speaking out loud is not available in this build. You can type instead.'
            : !handsFreeAvailable
              ? 'Tap to start recording, then tap again to send.'
              : inConversation
                ? 'Ends hands-free conversation. You can still type.'
                : 'Starts a hands-free conversation. Just talk — it sends when you stop, and listens again after it answers.'
        }
        // Deliberately NOT disabled mid-turn: leaving must always be possible,
        // including while it is thinking or speaking.
        accessibilityState={{ busy: isBusy }}
        onPress={onPress}
        testID={MIC_TEST_ID}
        style={({ pressed }) => [
          styles.button,
          active && styles.recording,
          pressed && styles.pressed,
          !isAvailable && styles.muted,
        ]}
      >
        <AppText role="bodyStrong" tone={active ? 'inverse' : 'action'}>
          {handsFreeAvailable ? (active ? '■ End' : '🎤 Talk') : active ? '■ Send' : '🎤'}
        </AppText>
      </Pressable>
    </View>
  );
}

/**
 * What the voice pipeline is doing — in words, with a timer and a live level.
 *
 * The level meter earns its place: it is the only thing on screen that proves
 * the microphone is actually hearing something. Without it, "Listening…" is a
 * claim, and the last version of this feature made that claim while recording
 * nothing at all.
 */
export function VoiceStage() {
  const { stage, error, elapsedMs, level, inConversation } = useVoiceSession();

  const recording = stage === 'recording';
  const text = inConversation ? CONVERSATION_TEXT[stage] : STAGE_TEXT[stage];
  if (error === null && text === null) return null;

  return (
    <View
      style={styles.stage}
      accessibilityRole={error !== null ? 'alert' : 'progressbar'}
      accessibilityLabel={
        recording ? `Listening. ${Math.floor((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000)} seconds so far.` : undefined
      }
      testID={VOICE_STAGE_TEST_ID}
    >
      <View style={styles.stageRow}>
        {recording && <View style={styles.dot} />}
        <AppText role="caption" tone={error !== null ? 'danger' : 'secondary'} style={styles.stageText}>
          {error ?? text}
        </AppText>
        {recording && (
          <AppText role="caption" tone="secondary" testID="voice-timer">
            {formatElapsed(elapsedMs)}
          </AppText>
        )}
      </View>
      {recording && <LevelMeter level={level} />}
    </View>
  );
}

/** Twelve bars that fill with input level, so silence is visible as silence. */
function LevelMeter({ level }: { level: number | null }) {
  const filled = Math.round(normalizeLevel(level) * BAR_COUNT);

  return (
    <View style={styles.meter} testID={LEVEL_METER_TEST_ID} accessibilityElementsHidden>
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <View key={index} style={[styles.bar, index < filled && styles.barOn]} />
      ))}
    </View>
  );
}

const BAR_COUNT = 12;

/**
 * Metering arrives in dBFS: about -160 for silence, 0 for as loud as it gets.
 * Anything below -50 is room noise, so the meter starts moving at speech.
 */
export function normalizeLevel(level: number | null): number {
  if (level === null || !Number.isFinite(level)) return 0;
  const floor = -50;
  if (level <= floor) return 0;
  if (level >= 0) return 1;
  return (level - floor) / -floor;
}

export function formatElapsed(ms: number): string {
  // The recorder reports no duration for the first poll or two. Without this
  // guard the timer renders "NaN:NaN" at exactly the moment a person is
  // looking at it to check whether the thing is working.
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const STAGE_TEXT: Record<string, string | null> = {
  idle: null,
  recording: 'Listening…',
  transcribing: 'Catching what you said…',
  thinking: 'Thinking about it…',
  speaking: 'Speaking…',
};

/**
 * In a conversation the person needs to know it is still THEIR turn to talk,
 * and that it will come back to them. "Listening — just talk" says both; a bare
 * "Listening…" leaves people waiting for a prompt that is not coming.
 */
const CONVERSATION_TEXT: Record<string, string | null> = {
  idle: 'In conversation',
  recording: 'Listening — just talk',
  transcribing: 'Catching what you said…',
  thinking: 'Thinking about it…',
  speaking: 'Speaking…',
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'flex-end',
  },
  button: {
    minWidth: theme.hitTarget.min,
    minHeight: theme.hitTarget.min,
    paddingHorizontal: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.controlBorder,
    backgroundColor: theme.color.surface,
  },
  recording: {
    backgroundColor: theme.color.humanPressed,
    borderColor: theme.color.humanPressed,
  },
  pressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  muted: {
    opacity: 0.5,
  },
  stage: {
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingBottom: theme.space.sm,
    gap: theme.space.xs,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  stageText: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.uncertaintyLow,
  },
  meter: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-end',
    height: 16,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.border,
  },
  barOn: {
    height: 16,
    backgroundColor: theme.color.uncertaintyHigh,
  },
});
