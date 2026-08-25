import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SELLER_FLOW_LENGTH, stepNumber, type RouteName } from '../navigation/routes';
import { theme } from '../theme';
import { AppText } from './AppText';

type Props = {
  route: RouteName;
  title: string;
  /** One or two sentences on what this step is for. Plain language, no jargon. */
  intro?: string;
  children?: ReactNode;
  /** Primary actions, pinned above the persistent human bar. */
  actions?: ReactNode;
};

/**
 * The scaffold for the intake screens that follow the conversation.
 *
 * It owns the flow position ("Step 2 of 7") and safe-area + scroll behaviour.
 *
 * It NO LONGER renders a persistent "get a human" bar. That bar was a
 * non-negotiable in the first four chunks and has been deliberately removed:
 * the AI is the experience, and a standing escape button framed it as a
 * waiting room in front of a person. A human now enters only when the AI
 * decides one is needed — see `EscalationOffer`.
 */
export function ScreenScaffold({ route, title, intro, children, actions }: Props) {
  const step = stepNumber(route);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          {step !== undefined && (
            <AppText role="micro" tone="secondary" uppercase accessibilityRole="header">
              Step {step} of {SELLER_FLOW_LENGTH}
            </AppText>
          )}
          <AppText role="title" accessibilityRole="header">
            {title}
          </AppText>
          {intro !== undefined && (
            <AppText tone="secondary">{intro}</AppText>
          )}
          {children}
        </View>
      </ScrollView>
      {actions !== undefined && <View style={styles.actions}>{actions}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingVertical: theme.layout.screenPaddingVertical,
  },
  inner: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignSelf: 'center',
    gap: theme.space.md,
  },
  actions: {
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingBottom: theme.space.md,
    gap: theme.space.sm,
  },
});
