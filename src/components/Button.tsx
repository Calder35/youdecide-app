import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'human' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Screen-reader hint when the label alone doesn't say what happens next. */
  accessibilityHint?: string;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. Announced as "busy". */
  busy?: boolean;
  /** Why the button is disabled — shown, so a dead button is never a mystery. */
  disabledReason?: string;
  testID?: string;
  style?: ViewStyle;
};

/**
 * The app's button.
 *
 * `human` is its own variant rather than a color prop: the handoff must look
 * different from a normal action everywhere it appears, and that should not
 * depend on each screen remembering to style it.
 *
 * A disabled button states its reason. A control that refuses to work without
 * saying why is the most common way an app wastes someone's afternoon.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  accessibilityHint,
  disabled = false,
  busy = false,
  disabledReason,
  testID,
  style,
}: Props) {
  const inert = disabled || busy;

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          inert && disabledReason !== undefined ? disabledReason : accessibilityHint
        }
        accessibilityState={{ disabled: inert, busy }}
        disabled={inert}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          variantStyles[variant],
          pressed && pressedStyles[variant],
          inert && styles.disabled,
          style,
        ]}
      >
        {busy ? (
          <ActivityIndicator
            color={variant === 'secondary' ? theme.color.actionSecondaryText : theme.color.textInverse}
          />
        ) : (
          <AppText role="bodyStrong" tone={labelTone[variant]}>
            {label}
          </AppText>
        )}
      </Pressable>
      {inert && disabledReason !== undefined && (
        <AppText
          role="caption"
          tone="secondary"
          style={styles.reason}
          testID={testID !== undefined ? `${testID}-reason` : undefined}
        >
          {disabledReason}
        </AppText>
      )}
    </View>
  );
}

const labelTone = {
  primary: 'inverse',
  secondary: 'action',
  human: 'inverse',
  danger: 'inverse',
} as const;

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.actionPrimary,
  },
  secondary: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.controlBorder,
  },
  human: {
    backgroundColor: theme.color.humanPressed,
    borderColor: theme.color.humanPressed,
  },
  danger: {
    backgroundColor: theme.color.uncertaintyLow,
    borderColor: theme.color.uncertaintyLow,
  },
});

const pressedStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.color.actionPrimaryPressed,
    borderColor: theme.color.actionPrimaryPressed,
  },
  secondary: {
    backgroundColor: theme.color.surfaceMuted,
  },
  human: {
    backgroundColor: theme.color.human,
  },
  danger: {
    opacity: 0.85,
  },
});

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.space.xs,
  },
  base: {
    minHeight: theme.hitTarget.min,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  reason: {
    textAlign: 'center',
  },
});
