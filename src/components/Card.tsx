import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { theme } from '../theme';

type Props = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  tone?: 'default' | 'human' | 'muted';
  style?: ViewStyle;
  testID?: string;
};

/** A titled surface. The workhorse container for the prototype screens. */
export function Card({ title, subtitle, children, tone = 'default', style, testID }: Props) {
  return (
    <View style={[styles.card, tone === 'human' && styles.human, tone === 'muted' && styles.muted, style]} testID={testID}>
      {title !== undefined && (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      )}
      {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
  human: {
    backgroundColor: theme.color.humanSurface,
    borderColor: theme.color.human,
  },
  muted: {
    backgroundColor: theme.color.surfaceMuted,
  },
  title: {
    ...theme.textStyle.subheading,
    color: theme.color.textPrimary,
  },
  subtitle: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
});
