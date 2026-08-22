import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

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
        <AppText role="subheading" accessibilityRole="header">
          {title}
        </AppText>
      )}
      {subtitle !== undefined && (
        <AppText role="caption" tone="secondary">
          {subtitle}
        </AppText>
      )}
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
});
