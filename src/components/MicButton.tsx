import { Pressable, StyleSheet, View } from 'react-native';

import { useVoiceSession } from '../state/VoiceSession';
import { theme } from '../theme';
import { AppText } from './AppText';

export const MIC_TEST_ID = 'mic-button';
export const VOICE_STAGE_TEST_ID = 'voice-stage';

/**
 * Hold to speak.
 *
 * Press-and-hold rather than tap-to-toggle: holding makes the end of your turn
 * explicit, so nobody is left wondering whether it is still listening — and
 * letting go is a more forgiving way out than hunting for a stop button
 * mid-sentence.
 *
 * It sits BESIDE the text composer, never in front of it. Voice is additive:
 * anyone who would rather type, or whose microphone will not work, loses
 * nothing.
 */
export function MicButton() {
  const { stage, isAvailable, isBusy, startListening, stopListeningAndRespond } =
    useVoiceSession();

  const recording = stage === 'recording';
  const label = recording ? 'Release to send what you said' : 'Hold to speak';

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          isAvailable
            ? 'Hold while you speak. You Decide AI will answer out loud.'
            : 'Speaking out loud is not available in this build. You can type instead.'
        }
        accessibilityState={{ disabled: isBusy, busy: isBusy }}
        disabled={isBusy}
        onPressIn={() => void startListening()}
        onPressOut={() => void stopListeningAndRespond()}
        testID={MIC_TEST_ID}
        style={({ pressed }) => [
          styles.button,
          recording && styles.recording,
          pressed && styles.pressed,
          (isBusy || !isAvailable) && styles.muted,
        ]}
      >
        <AppText role="bodyStrong" tone={recording ? 'inverse' : 'action'}>
          {recording ? '● Listening' : '🎤'}
        </AppText>
      </Pressable>
    </View>
  );
}

/** What the voice pipeline is doing, in words rather than a spinner. */
export function VoiceStage() {
  const { stage, error } = useVoiceSession();

  const text = STAGE_TEXT[stage];
  if (error === null && text === null) return null;

  return (
    <View
      style={styles.stage}
      accessibilityRole={error !== null ? 'alert' : 'progressbar'}
      testID={VOICE_STAGE_TEST_ID}
    >
      <AppText role="caption" tone={error !== null ? 'danger' : 'secondary'}>
        {error ?? text}
      </AppText>
    </View>
  );
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
  },
});
