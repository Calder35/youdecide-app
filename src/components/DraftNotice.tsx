import { StyleSheet, View } from 'react-native';

import {
  DRAFT_NOTICE_BODY,
  DRAFT_NOTICE_TITLE,
  NEVADA_COPY_IS_DRAFT,
} from '../content/nevada';
import { theme } from '../theme';
import { AppText } from './AppText';

export const DRAFT_NOTICE_TEST_ID = 'draft-notice';

/**
 * Visible marker on any screen carrying unreviewed Nevada-specific copy.
 *
 * It renders only while `REVIEW_STATUS` in `src/content/nevada.ts` says the
 * copy is unreviewed — so when a licensed agent signs off, flipping that one
 * constant removes every notice at once. Nobody has to remember to delete them.
 *
 * A test asserts that each screen rendering Nevada copy also renders this,
 * which is what stops the copy reaching a real seller unmarked.
 */
export function DraftNotice() {
  if (!NEVADA_COPY_IS_DRAFT) return null;

  return (
    <View style={styles.container} accessibilityRole="alert" testID={DRAFT_NOTICE_TEST_ID}>
      <AppText role="micro" tone="caution" uppercase>
        {DRAFT_NOTICE_TITLE}
      </AppText>
      <AppText role="caption" tone="secondary">
        {DRAFT_NOTICE_BODY}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.uncertaintyMediumSurface,
    borderWidth: 1,
    borderColor: theme.color.uncertaintyMedium,
    borderStyle: 'dashed',
    borderRadius: theme.radius.sm,
    padding: theme.space.md,
    gap: theme.space.xxs,
  },
});
