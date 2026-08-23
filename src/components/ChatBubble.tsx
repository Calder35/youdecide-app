import { StyleSheet, View } from 'react-native';

import type { ChatTurn } from '../state/ChatSession';
import { theme } from '../theme';
import { AppText } from './AppText';

/**
 * One turn in the conversation.
 *
 * The AI's turns are left-aligned on a plain surface and the person's are
 * right-aligned and tinted — the ordinary convention, because this is not the
 * place to be inventive. Each bubble is one accessibility element so a screen
 * reader announces "You Decide AI said …" rather than reading a wall of
 * unattributed text.
 */
export function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isAi = turn.role === 'ai';
  const speaker = isAi ? 'You Decide AI' : 'You';

  return (
    <View
      style={[styles.row, isAi ? styles.rowAi : styles.rowYou]}
      accessible
      accessibilityLabel={`${speaker} said: ${turn.text}`}
      testID={`turn-${turn.role}`}
    >
      <View style={[styles.bubble, isAi ? styles.bubbleAi : styles.bubbleYou]}>
        {isAi && (
          <AppText role="micro" tone="secondary" uppercase style={styles.speaker}>
            {speaker}
          </AppText>
        )}
        <AppText tone={isAi ? 'primary' : 'inverse'}>{turn.text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: theme.space.md,
  },
  rowAi: {
    justifyContent: 'flex-start',
    paddingRight: theme.space.xxl,
  },
  rowYou: {
    justifyContent: 'flex-end',
    paddingLeft: theme.space.xxl,
  },
  bubble: {
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    gap: theme.space.xxs,
    maxWidth: '100%',
  },
  bubbleAi: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderTopLeftRadius: theme.radius.sm,
  },
  bubbleYou: {
    backgroundColor: theme.color.actionPrimary,
    borderTopRightRadius: theme.radius.sm,
  },
  speaker: {
    marginBottom: theme.space.xxs,
  },
});
