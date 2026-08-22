import { StyleSheet, View } from 'react-native';

import type { Sourced } from '../data/types';
import { theme } from '../theme';
import { AppText } from './AppText';
import { SourceNote } from './SourceNote';

type Props = {
  label: string;
  /** A value that carries its own provenance. There is no bare-number variant. */
  value: Sourced<string>;
  /** Marks a figure the seller corrected — their word beats the record. */
  correctedBySeller?: boolean;
  testID?: string;
};

/**
 * A labelled figure with its provenance attached.
 *
 * The API is the point: `value` must be a `Sourced<string>`, so there is no way
 * to render a figure through this component without also saying where it came
 * from. If a future screen wants a bare number, it has to go out of its way —
 * which is exactly the friction we want.
 */
export function Figure({ label, value, correctedBySeller = false, testID }: Props) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <AppText role="body" tone="secondary" style={styles.label}>
          {label}
        </AppText>
        <AppText role="bodyStrong" style={styles.value}>
          {value.value}
        </AppText>
      </View>
      {correctedBySeller && (
        <AppText role="micro" tone="action" uppercase>
          You corrected this
        </AppText>
      )}
      <SourceNote of={value} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap: theme.space.xxs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.space.md,
  },
  label: {
    flex: 1,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
