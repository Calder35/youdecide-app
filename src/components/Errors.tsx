import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

/**
 * Error presentation, in two sizes.
 *
 * House rules, applied by these components rather than left to each screen:
 *   - An error says what to do next, not just that something is wrong.
 *   - Color is never the only signal — there is always text, and an icon glyph.
 *   - Errors are announced to screen readers (`role="alert"`), because a
 *     visually-hidden failure is a failure the person cannot fix.
 */

type InlineProps = {
  /** Plain language, and actionable. "Add an email so an agent can reply." */
  message: string;
  testID?: string;
};

/** A single field's problem, sitting directly under that field. */
export function InlineError({ message, testID }: InlineProps) {
  return (
    <View style={styles.inline} accessibilityRole="alert" testID={testID}>
      <AppText role="caption" tone="danger" style={styles.glyph}>
        !
      </AppText>
      <AppText role="caption" tone="danger" style={styles.inlineText}>
        {message}
      </AppText>
    </View>
  );
}

type BannerProps = {
  title: string;
  message: string;
  /** What the seller can do about it, if there is something. */
  action?: React.ReactNode;
  testID?: string;
};

/** A whole-screen or whole-form problem. */
export function ErrorBanner({ title, message, action, testID }: BannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert" testID={testID}>
      <AppText role="bodyStrong" tone="danger">
        {title}
      </AppText>
      <AppText role="body">{message}</AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
  },
  glyph: {
    width: 14,
    textAlign: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.uncertaintyLow,
    overflow: 'hidden',
  },
  inlineText: {
    flex: 1,
  },
  banner: {
    backgroundColor: theme.color.uncertaintyLowSurface,
    borderWidth: 1,
    borderColor: theme.color.uncertaintyLow,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
});
