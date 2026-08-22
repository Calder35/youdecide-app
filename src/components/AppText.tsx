import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { theme } from '../theme';
import type { TextStyleToken } from '../theme';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'inverse'
  | 'action'
  | 'human'
  | 'danger'
  | 'success'
  | 'caution';

// `role` is omitted from TextProps on purpose: React Native already has a
// `role` prop for ARIA roles, and an intersection would collapse ours to it.
// Accessibility roles go through `accessibilityRole`.
type Props = Omit<TextProps, 'role'> & {
  role?: TextStyleToken;
  tone?: TextTone;
  /** Small-caps-ish label treatment for section markers and metadata. */
  uppercase?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * The only text component.
 *
 * Screens pick a NAMED role and tone rather than a font size and hex, which is
 * what keeps the reading hierarchy consistent across ten screens written at
 * different times. It also gives one place to hold accessibility decisions:
 * text scales with the OS setting here, and nothing opts out.
 */
export function AppText({ role = 'body', tone = 'primary', uppercase, style, ...rest }: Props) {
  return (
    <Text
      // Deliberately NOT disabled and NOT capped: a seller who has set large
      // text on their phone gets large text here, including in the fine print.
      allowFontScaling
      {...rest}
      style={[theme.textStyle[role], toneStyles[tone], uppercase && styles.uppercase, style]}
    />
  );
}

const toneStyles = StyleSheet.create({
  primary: { color: theme.color.textPrimary },
  secondary: { color: theme.color.textSecondary },
  inverse: { color: theme.color.textInverse },
  action: { color: theme.color.actionSecondaryText },
  human: { color: theme.color.humanPressed },
  danger: { color: theme.color.uncertaintyLow },
  success: { color: theme.color.uncertaintyHigh },
  caution: { color: theme.color.uncertaintyMedium },
});

const styles = StyleSheet.create({
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
