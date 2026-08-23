import { useCallback, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { ChatBubble } from '../components/ChatBubble';
import { ChatComposer } from '../components/ChatComposer';
import { EscalationOffer } from '../components/EscalationOffer';
import { InlineError } from '../components/Errors';
import { TypingIndicator } from '../components/TypingIndicator';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useChatSession } from '../state/ChatSession';
import { theme } from '../theme';
import { Button } from '../components/Button';

export const CHAT_SCREEN_TEST_ID = 'chat-screen';

/**
 * The front door.
 *
 * A brief welcome and then, immediately, a conversation. The AI leads with
 * discovery — it asks about the person and reflects back what it heard before
 * it proposes anything.
 *
 * WHAT IS DELIBERATELY ABSENT, and must stay absent:
 *   - the fee, in any form
 *   - "list your home", or any framing of the person as a seller
 *   - a step counter, progress bar, or anything that reads as a form
 *   - a standing "talk to a human" button
 *
 * A person arrives here as someone with a situation, not as a lead partway
 * through an intake. Everything the app used to open with is still in the
 * codebase and still reachable — it is just no longer the first thing anyone
 * meets. `chatScreen.test.tsx` holds this.
 */
export function ChatScreen({ navigation }: RootStackScreenProps<'Chat'>) {
  const { turns, thinking, error, send, retry, escalation, escalationNote } = useChatSession();
  const scrollRef = useRef<ScrollView>(null);

  // Keep the newest turn in view. `animated` so it reads as the conversation
  // moving rather than the screen jumping.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [turns.length, thinking, escalation]);

  const onSend = useCallback((message: string) => void send(message), [send]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']} testID={CHAT_SCREEN_TEST_ID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>
            <View style={styles.welcome}>
              <AppText role="title" accessibilityRole="header">
                You Decide AI
              </AppText>
              <AppText tone="secondary">
                A conversation, not a form. Start wherever you like — I&rsquo;ll listen first.
              </AppText>
            </View>

            {turns.map((turn) => (
              <ChatBubble key={turn.id} turn={turn} />
            ))}

            {thinking && <TypingIndicator />}

            <EscalationOffer kind={escalation} note={escalationNote} />

            {error !== null && (
              <View style={styles.error}>
                <InlineError message={error} testID="chat-error" />
                <Button
                  label="Try sending again"
                  variant="secondary"
                  testID="chat-retry"
                  onPress={() => void retry()}
                />
              </View>
            )}

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="How your conversation is used"
              testID="link-privacy"
              onPress={() => navigation.navigate(ROUTES.Privacy)}
              style={styles.privacy}
            >
              <AppText role="micro" tone="secondary" style={styles.privacyText}>
                How your conversation is used
              </AppText>
            </Pressable>
          </View>
        </ScrollView>

        <ChatComposer onSend={onSend} disabled={thinking} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.lg,
  },
  inner: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignSelf: 'center',
  },
  welcome: {
    gap: theme.space.xs,
    marginBottom: theme.space.xl,
  },
  error: {
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  privacy: {
    minHeight: theme.hitTarget.min,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  privacyText: {
    textDecorationLine: 'underline',
  },
});
