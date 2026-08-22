import { Pressable, StyleSheet, View } from 'react-native';

import type { ConsentDefinition } from '../data/types';
import { theme } from '../theme';
import { AppText } from './AppText';
import { Disclosure } from './Disclosure';

type Props = {
  consent: ConsentDefinition;
  checked: boolean;
  onToggle: () => void;
  /** When it was agreed to, if it has been. Display-only. */
  agreedAt?: string;
  testID?: string;
};

/**
 * One consent, presented so agreeing is an informed act.
 *
 * The rules this component exists to hold:
 *   - The thing being agreed to is ON SCREEN, in full, next to the box. Never
 *     behind a link, never truncated, never "see terms".
 *   - Required and optional are labelled in words, so declining the optional
 *     one is visibly a real choice rather than a trick.
 *   - "Why we're asking" and "what happens if you decline" are one tap away —
 *     that is explanation, which may be collapsed; the agreement itself is not.
 *   - The checkbox announces itself as a checkbox with its state, and the whole
 *     row is the target, at least 44pt tall.
 */
export function ConsentItem({ consent, checked, onToggle, agreedAt, testID }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={consent.title}
        accessibilityHint={`${consent.required ? 'Required.' : 'Optional.'} ${consent.body}`}
        onPress={onToggle}
        testID={testID}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked && (
            <AppText role="bodyStrong" tone="inverse" style={styles.check}>
              ✓
            </AppText>
          )}
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <AppText role="bodyStrong" style={styles.title}>
              {consent.title}
            </AppText>
            <AppText
              role="micro"
              tone={consent.required ? 'danger' : 'secondary'}
              uppercase
              testID={testID !== undefined ? `${testID}-requirement` : undefined}
            >
              {consent.required ? 'Required' : 'Optional'}
            </AppText>
          </View>
          <AppText role="body" tone="secondary">
            {consent.body}
          </AppText>
          {agreedAt !== undefined && checked && (
            <AppText role="micro" tone="success">
              Agreed {agreedAt}
            </AppText>
          )}
        </View>
      </Pressable>

      <Disclosure
        summary="Why we're asking, and what happens if you decline"
        testID={testID !== undefined ? `${testID}-why` : undefined}
      >
        <AppText role="caption" tone="secondary">
          {consent.why}
        </AppText>
        <AppText role="caption" tone="secondary">
          {consent.ifDeclined}
        </AppText>
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  row: {
    flexDirection: 'row',
    gap: theme.space.md,
    minHeight: theme.hitTarget.min,
    paddingVertical: theme.space.xs,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    borderColor: theme.color.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    marginTop: theme.space.xxs,
  },
  boxChecked: {
    backgroundColor: theme.color.actionPrimary,
  },
  check: {
    lineHeight: 20,
  },
  copy: {
    flex: 1,
    gap: theme.space.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.space.sm,
  },
  title: {
    flex: 1,
  },
});
