import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { theme } from '../theme';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Screen-reader hint when the label alone doesn't say what happens next. */
  accessibilityHint?: string;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
};

/**
 * The one button in the scaffold. Chunk 3 grows the real design-system
 * component; this exists so no screen hand-rolls a Pressable with literal
 * colors in the meantime.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  accessibilityHint,
  disabled = false,
  testID,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.secondaryPressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.hitTarget.min,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.actionPrimary,
  },
  primaryPressed: {
    backgroundColor: theme.color.actionPrimaryPressed,
    borderColor: theme.color.actionPrimaryPressed,
  },
  secondary: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.actionSecondaryBorder,
  },
  secondaryPressed: {
    backgroundColor: theme.color.surfaceMuted,
  },
  disabled: {
    opacity: 0.5,
  },
  label: theme.textStyle.bodyStrong,
  primaryLabel: {
    color: theme.color.actionPrimaryText,
  },
  secondaryLabel: {
    color: theme.color.actionSecondaryText,
  },
});
