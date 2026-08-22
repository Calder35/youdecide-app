import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SELLER_FLOW_LENGTH, stepNumber, type RouteName } from '../navigation/routes';
import { theme } from '../theme';
import { GetHumanBar } from './GetHumanBar';

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
 * Every screen renders through this. It owns three things a screen must never
 * be able to opt out of:
 *   1. the persistent "get a human" bar,
 *   2. the flow position ("Step 2 of 7"), so the seller always knows where they
 *      are in the intake,
 *   3. safe-area + scroll behavior, so long copy is reachable on small phones.
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
            <Text style={styles.step} accessibilityRole="header">
              Step {step} of {SELLER_FLOW_LENGTH}
            </Text>
          )}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {intro !== undefined && <Text style={styles.intro}>{intro}</Text>}
          {children}
        </View>
      </ScrollView>
      {actions !== undefined && <View style={styles.actions}>{actions}</View>}
      <GetHumanBar />
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
  step: {
    ...theme.textStyle.micro,
    color: theme.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: theme.textStyle.title,
  intro: {
    ...theme.textStyle.body,
    color: theme.color.textSecondary,
  },
  actions: {
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingBottom: theme.space.md,
    gap: theme.space.sm,
  },
});
