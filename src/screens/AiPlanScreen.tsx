import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SourceNote } from '../components/SourceNote';
import { MOCK_PLAN } from '../data/mock';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';

export function AiPlanScreen({ navigation }: RootStackScreenProps<'AiPlan'>) {
  const { state, togglePlanStep } = useSellerSession();
  const needsApproval = MOCK_PLAN.filter((step) => step.needsHumanApproval).length;

  return (
    <ScreenScaffold
      route={ROUTES.AiPlan}
      title="Your listing plan"
      intro={`Five steps, in order, each with what it was based on. ${needsApproval} of them cannot happen until a licensed Nevada agent approves them — the app cannot do those on its own.`}
      actions={
        <>
          <Button
            label="Ask a licensed agent to review this"
            testID="cta-request-human"
            accessibilityHint="Opens the handoff screen, which lists exactly what is shared before anything is sent."
            onPress={() => navigation.navigate(ROUTES.GetHuman, { from: ROUTES.AiPlan })}
          />
          <Button
            label="Continue"
            variant="secondary"
            testID="cta-continue"
            onPress={() => navigation.navigate(ROUTES.Status)}
          />
        </>
      }
    >
      {MOCK_PLAN.map((step, index) => {
        const done = state.completedPlanSteps.includes(step.id);
        return (
          <Card key={step.id} testID={`plan-${step.id}`}>
            <View style={styles.header}>
              <Text style={styles.index}>{index + 1}</Text>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{step.title}</Text>
                {step.needsHumanApproval && (
                  <Text style={styles.approval} testID={`approval-${step.id}`}>
                    A licensed agent approves this
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.detail}>{step.detail}</Text>
            <SourceNote of={step.basis} />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`Mark "${step.title}" as done`}
              testID={`toggle-${step.id}`}
              onPress={() => togglePlanStep(step.id)}
              style={styles.toggle}
            >
              <View style={[styles.box, done && styles.boxChecked]}>
                {done && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.toggleLabel}>{done ? 'Done' : 'Mark as done'}</Text>
            </Pressable>
          </Card>
        );
      })}

      <Card tone="human" title="Nothing here goes live on its own">
        <Text style={styles.detail}>
          This app cannot publish a listing, send an offer response, or sign anything. Those need a
          licensed Nevada agent, every time.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  index: {
    ...theme.textStyle.heading,
    color: theme.color.textDisabled,
    minWidth: 24,
  },
  headerCopy: {
    flex: 1,
    gap: theme.space.xxs,
  },
  title: {
    ...theme.textStyle.subheading,
    color: theme.color.textPrimary,
  },
  approval: {
    ...theme.textStyle.micro,
    color: theme.color.humanPressed,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detail: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    minHeight: theme.hitTarget.min,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    borderColor: theme.color.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: theme.color.actionPrimary,
  },
  check: {
    color: theme.color.actionPrimaryText,
    ...theme.textStyle.caption,
  },
  toggleLabel: {
    ...theme.textStyle.body,
    color: theme.color.actionSecondaryText,
  },
});
