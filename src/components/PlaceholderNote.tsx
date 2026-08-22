import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type Props = {
  /** Which chunk fills this in — keeps the scaffold honest about what is stubbed. */
  chunk: 2 | 3 | 4;
  children: string;
};

/**
 * A visible "not built yet" marker. The scaffold is navigable but empty; saying
 * so on-screen is better than a screen that looks finished and isn't.
 */
export function PlaceholderNote({ chunk, children }: Props) {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.badge}>Placeholder — chunk {chunk}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.xs,
  },
  badge: {
    ...theme.textStyle.micro,
    color: theme.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
});
