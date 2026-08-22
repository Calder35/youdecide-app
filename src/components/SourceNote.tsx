import { StyleSheet, Text, View } from 'react-native';

import { CONFIDENCE_LABEL, type Confidence, type Sourced } from '../data/types';
import { theme } from '../theme';

/**
 * Where a figure came from, and how sure we are.
 *
 * The product principle in one component: no number appears without this
 * underneath it. Chunk 3 turns it into the fuller trust component (tappable,
 * with the plain-language meaning of each level); chunk 2 needs it visible now,
 * because a prototype that shows bare numbers teaches the wrong thing in user
 * testing.
 */
export function SourceNote({ of }: { of: Sourced<unknown> }) {
  const label = CONFIDENCE_LABEL[of.confidence];

  return (
    <View style={styles.row}>
      <View style={[styles.dot, confidenceDot[of.confidence]]} accessibilityElementsHidden />
      <Text style={styles.text} accessibilityLabel={`${label}. Source: ${of.source}.`}>
        <Text style={[styles.confidence, confidenceText[of.confidence]]}>{label}</Text>
        {` · ${of.source}`}
        {of.asOf !== undefined ? ` · as of ${of.asOf}` : ''}
      </Text>
    </View>
  );
}

const confidenceText: Record<Confidence, { color: string }> = {
  high: { color: theme.color.uncertaintyHigh },
  medium: { color: theme.color.uncertaintyMedium },
  low: { color: theme.color.uncertaintyLow },
};

const confidenceDot: Record<Confidence, { backgroundColor: string }> = {
  high: { backgroundColor: theme.color.uncertaintyHigh },
  medium: { backgroundColor: theme.color.uncertaintyMedium },
  low: { backgroundColor: theme.color.uncertaintyLow },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
    marginTop: theme.space.xxs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    marginTop: 5,
  },
  text: {
    ...theme.textStyle.micro,
    color: theme.color.textSecondary,
    flex: 1,
  },
  confidence: {
    ...theme.textStyle.micro,
  },
});
