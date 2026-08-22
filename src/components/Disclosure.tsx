import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type Props = {
  /** The question, in the seller's words: "Why are you asking for this?" */
  summary: string;
  children: ReactNode;
  /** Open on first render — use for anything a seller should not have to hunt for. */
  defaultOpen?: boolean;
  testID?: string;
};

/**
 * Expandable detail.
 *
 * Used for the "why we're asking" and "what this confidence level means" copy.
 * The rule it exists to enforce: a disclosure may hide EXPLANATION, never the
 * thing being agreed to or the number being relied on. Those stay on screen.
 *
 * Accessibility: it is a button that reports its expanded state, so a screen
 * reader announces "collapsed"/"expanded" rather than leaving a person to
 * guess whether tapping did anything.
 */
export function Disclosure({ summary, children, defaultOpen = false, testID }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides this explanation.' : 'Shows more explanation.'}
        testID={testID}
        onPress={() => setOpen((current) => !current)}
        style={styles.trigger}
      >
        <AppText role="caption" tone="action" style={styles.chevron}>
          {open ? '▾' : '▸'}
        </AppText>
        <AppText role="caption" tone="action" style={styles.summary}>
          {summary}
        </AppText>
      </Pressable>
      {open && (
        <View style={styles.body} testID={testID !== undefined ? `${testID}-body` : undefined}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.space.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    minHeight: theme.hitTarget.min,
  },
  chevron: {
    width: 12,
  },
  summary: {
    flex: 1,
    textDecorationLine: 'underline',
  },
  body: {
    paddingLeft: theme.space.xl,
    gap: theme.space.xs,
    paddingBottom: theme.space.sm,
  },
});
