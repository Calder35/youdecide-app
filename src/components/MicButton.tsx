import { Pressable, StyleSheet, View } from 'react-native';

import { useVoiceSession } from '../state/VoiceSession';
import { theme } from '../theme';
import { AppText } from './AppText';

export const MIC_TEST_ID = 'mic-button';
export const VOICE_STAGE_TEST_ID = 'voice-stage';
export const LEVEL_METER_TEST_ID = 'voice-level';

/**
 * Tap to start. Tap to stop.
 *
 * IT USED TO BE PRESS-AND-HOLD, AND THAT WAS THE BUG. `onPressIn` began an
 * async start (permission, audio mode, prepare) and `onPressOut` stopped it — so
 * a tap stopped a recording that had not begun, and the first tap of all raced
 * the permission dialog. Nothing was ever recorded, and the app blamed the
 * person's voice for it.
 *
 * Tap-to-toggle removes the race by construction and is the more forgiving
 * pattern anyway: nobody has to keep a finger down while finding their words,
 * which is precisely when someone talking about something hard would pause.
 */
export function MicButton() {
  const { stage, isAvailable, isBusy, startListening, stopListeningAndRespond } =
    useVoiceSession();

  const recording = stage === 'recording';
  const label = recording ? 'Stop recording and send' : 'Tap to speak';

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          isAvailable
            ? 'Tap once to start recording, speak, then tap again when you are finished.'
            : 'Speaking out loud is not available in this build. You can type instead.'
        }
        accessibilityState={{ disabled: isBusy, busy: isBusy }}
        disabled={isBusy}
        onPress={() => void (recording ? stopListeningAndRespond() : startListening())}
        testID={MIC_TEST_ID}
        style={({ pressed }) => [
          styles.button,
          recording && styles.recording,
          pressed && styles.pressed,
          (isBusy || !isAvailable) && styles.muted,
        ]}
      >
        <AppText role="bodyStrong" tone={recording ? 'inverse' : 'action'}>
          {recording ? '■ Stop' : '🎤'}
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
  const { stage, error, elapsedMs, level } = useVoiceSession();

  const recording = stage === 'recording';
  const text = STAGE_TEXT[stage];
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
