import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

export const TYPING_TEST_ID = 'ai-typing';

/**
 * The AI is composing.
 *
 * Words rather than animated dots: it is announced to a screen reader as a
 * status, and "You Decide AI is thinking" is more honest about what is
 * happening than three bouncing circles.
 */
export function TypingIndicator() {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="You Decide AI is thinking"
      testID={TYPING_TEST_ID}
    >
      <AppText role="caption" tone="secondary">
        You Decide AI is thinking…
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginBottom: theme.space.md,
  },
});
