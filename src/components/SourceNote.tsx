import { StyleSheet, View } from 'react-native';

import { CONFIDENCE_LABEL, CONFIDENCE_MEANING, type Confidence, type Sourced } from '../data/types';
import { theme } from '../theme';
import { AppText, type TextTone } from './AppText';
import { Disclosure } from './Disclosure';

/**
 * Where a figure came from, and how sure we are.
 *
 * The product principle as a component: no number appears without this
 * underneath it. Three things it deliberately does:
 *
 *   1. States the confidence in words, never only as a colored dot — the
 *      difference between "high" and "low" must survive being colorblind, or
 *      being read aloud.
 *   2. Names the source in the language we would use out loud, not a system id.
 *   3. Lets a seller open what the confidence level actually MEANS, because
 *      "medium confidence" is meaningless on its own.
 */

type Props = {
  of: Sourced<unknown>;
  /** Give the disclosure a stable id for tests and screen-reader labelling. */
  testID?: string;
};

export function SourceNote({ of, testID }: Props) {
  const label = CONFIDENCE_LABEL[of.confidence];
  const spoken = `${label}. Source: ${of.source}.${
    of.asOf !== undefined ? ` Read on ${of.asOf}.` : ''
  }`;

  return (
    <View style={styles.container}>
      <View style={styles.row} accessible accessibilityLabel={spoken}>
        <View style={[styles.dot, dotStyles[of.confidence]]} accessibilityElementsHidden />
        <AppText role="micro" tone="secondary" style={styles.text}>
          <AppText role="micro" tone={confidenceTone[of.confidence]}>
            {label}
          </AppText>
          {` · ${of.source}`}
          {of.asOf !== undefined ? ` · as of ${of.asOf}` : ''}
        </AppText>
      </View>
      <Disclosure
        summary={`What does "${label.toLowerCase()}" mean?`}
        testID={testID !== undefined ? `${testID}-meaning` : undefined}
      >
        <AppText role="caption" tone="secondary">
          {CONFIDENCE_MEANING[of.confidence]}
        </AppText>
        <AppText role="caption" tone="secondary">
          Anything you disagree with is worth raising with a licensed agent — your correction
          outranks the record.
        </AppText>
      </Disclosure>
    </View>
  );
}

const confidenceTone: Record<Confidence, TextTone> = {
  high: 'success',
  medium: 'caution',
  low: 'danger',
};

const dotStyles = StyleSheet.create({
  high: { backgroundColor: theme.color.uncertaintyHigh },
  medium: { backgroundColor: theme.color.uncertaintyMedium },
  low: { backgroundColor: theme.color.uncertaintyLow },
});

const styles = StyleSheet.create({
  container: {
    gap: theme.space.xxs,
    marginTop: theme.space.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    marginTop: 5,
  },
  text: {
    flex: 1,
  },
});
