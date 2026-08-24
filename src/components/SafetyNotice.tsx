import { StyleSheet, View } from 'react-native';

import type { EscalationKind } from '../api/chat';
import { theme } from '../theme';
import { AppText } from './AppText';

export const SAFETY_NOTICE_TEST_ID = 'safety-notice';

/**
 * Self-harm safety copy. Deliberately separate, and deliberately unreachable
 * from the housing conversation.
 *
 * WHY IT IS ITS OWN FILE. This used to be one branch inside the handoff card,
 * which meant every widening of "someone should help" dragged a suicide hotline
 * along with it — and it did: a person saying they were behind on their
 * mortgage was shown a crisis card. Splitting it means the housing flow cannot
 * reach this by accident, because the housing flow does not render an emotional
 * card at all.
 *
 * WHEN IT SHOWS. Only when the backend explicitly returns
 * `escalate_kind: "distress"`, which the backend gates to a narrow path that
 * financial and housing situations do not take. Financial hardship — arrears,
 * foreclosure, an unaffordable payment — is ordinary business for this product
 * and is handled conversationally with no card of any kind.
 *
 * ⚠️ REVIEW BEFORE REAL USERS. This is safety copy written by an engineer. It
 * names a US resource and has not been reviewed or localised. If the gate ever
 * widens, this text needs a person qualified to write it.
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
