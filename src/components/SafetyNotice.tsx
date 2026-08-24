import { StyleSheet, View } from 'react-native';

import type { EscalationKind } from '../api/chat';
import { theme } from '../theme';
import { AppText } from './AppText';

export const SAFETY_NOTICE_TEST_ID = 'safety-notice';

/**
 * ⛔️ DORMANT — NOT MOUNTED ANYWHERE. DO NOT WIRE THIS UP WITHOUT A DECISION.
 *
 * Self-harm safety copy, kept in the repo but deliberately disconnected from
 * the app. Nothing imports it, so no input, no backend response, and no
 * `escalate_kind` can cause it to render.
 *
 * WHY IT IS OFF. This is a housing product. A live test showed the cost of
 * mixing the two registers: the backend returned `distress` for someone saying
 * they were three months behind on their mortgage, and the app answered a
 * financial question with a suicide hotline. Financial hardship — arrears,
 * foreclosure, an unaffordable payment — is the ordinary reason people sell a
 * house, and this product handles it as business. The product decision is that
 * crisis content does not belong in it at all, rather than being gated and
 * hoped about.
 *
 * WHAT THAT MEANS TODAY. `escalate_kind: "distress"` renders NOTHING in the
 * app. The conversational reply from the backend still reaches the person —
 * only the card is gone. `crisisContent.test.tsx` asserts that no path can
 * mount this.
 *
 * IF IT IS EVER TURNED BACK ON, it needs a person qualified to write safety
 * copy, a licensed review, and localisation beyond the US resource named
 * below. An engineer wrote this text; that was fine for a placeholder and is
 * not fine for something a person in danger would read.
 *
 * WHY IT IS ITS OWN FILE RATHER THAN DELETED. It was once a branch inside the
 * handoff card, which is how it reached a mortgage conversation in the first
 * place. Keeping it separate and unmounted preserves the work without leaving
 * a branch that a future widening of "someone should help" can fall into.
 *
 */
export function SafetyNotice({ kind }: { kind: EscalationKind }) {
  if (kind !== 'distress') return null;

  return (
    <View style={styles.container} accessibilityRole="alert" testID={SAFETY_NOTICE_TEST_ID}>
      <AppText role="bodyStrong">You do not have to deal with this on your own</AppText>
      <AppText role="body" tone="secondary">
        If you are in immediate danger, please contact your local emergency services. In the US you
        can call or text 988 to reach the Suicide &amp; Crisis Lifeline, any time.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.surface,
    borderWidth: 2,
    borderColor: theme.color.uncertaintyLow,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
});
