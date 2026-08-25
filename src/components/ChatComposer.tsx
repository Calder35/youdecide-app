import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

export const COMPOSER_INPUT_TEST_ID = 'chat-input';
export const COMPOSER_SEND_TEST_ID = 'chat-send';

/**
 * Where the person types.
 *
 * Multiline and unhurried — the placeholder invites a sentence, not a keyword,
 * because the quality of discovery depends on people actually saying things.
 * Send is disabled on empty input and while the AI is composing, so a person
 * cannot stack three messages on top of an unanswered one.
 */
export function ChatComposer({
  onSend,
  disabled = false,
  /** Rendered beside the input — the mic. Voice is additive, never a swap. */
  accessory,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  accessory?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Your message to You Decide AI"
        accessibilityHint="Type what is on your mind, then send."
        value={draft}
        onChangeText={setDraft}
        placeholder="Say as much or as little as you like…"
        placeholderTextColor={theme.color.textPlaceholder}
        multiline
        editable={!disabled}
        testID={COMPOSER_INPUT_TEST_ID}
        style={styles.input}
      />
      {accessory}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={submit}
        testID={COMPOSER_SEND_TEST_ID}
        style={({ pressed }) => [
          styles.send,
          !canSend && styles.sendDisabled,
          pressed && canSend && styles.sendPressed,
        ]}
      >
        <AppText role="bodyStrong" tone="inverse">
          Send
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  input: {
    flex: 1,
    minHeight: theme.hitTarget.min,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: theme.color.controlBorder,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
    textAlignVertical: 'top',
  },
  send: {
    minHeight: theme.hitTarget.min,
    paddingHorizontal: theme.space.xl,
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.actionPrimary,
  },
  sendPressed: {
    backgroundColor: theme.color.actionPrimaryPressed,
  },
  sendDisabled: {
    opacity: 0.4,
  },
});
