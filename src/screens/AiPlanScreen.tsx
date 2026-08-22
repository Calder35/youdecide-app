import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DraftNotice } from '../components/DraftNotice';
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
      intro={`${MOCK_PLAN.length} steps, in order, each with what it was based on. ${needsApproval} of them cannot happen until a licensed Nevada agent approves them — the app cannot do those on its own.`}
      actions={
        <>
          <Button
            label="Ask a licensed agent to review this"
            variant="human"
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
              <AppText role="heading" style={styles.index}>
                {index + 1}
              </AppText>
              <View style={styles.headerCopy}>
                <AppText role="subheading">{step.title}</AppText>
                {step.needsHumanApproval && (
                  <AppText
                    role="micro"
                    tone="human"
                    uppercase
                    testID={`approval-${step.id}`}
                  >
                    A licensed agent approves this
                  </AppText>
                )}
              </View>
            </View>
            <AppText>{step.detail}</AppText>
            <SourceNote of={step.basis} testID={`plan-${step.id}`} />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`Mark "${step.title}" as done`}
              testID={`toggle-${step.id}`}
              onPress={() => togglePlanStep(step.id)}
              style={styles.toggle}
            >
              <View style={[styles.box, done && styles.boxChecked]}>
                {done && (
                  <AppText role="caption" tone="inverse">
                    ✓
                  </AppText>
                )}
              </View>
              <AppText tone="action">{done ? 'Done' : 'Mark as done'}</AppText>
            </Pressable>
          </Card>
        );
      })}

      <DraftNotice />

      <Card tone="human" title="Nothing here goes live on its own">
        <AppText>
          This app cannot publish a listing, send an offer response, or sign anything. Those need a
          licensed Nevada agent, every time.
        </AppText>
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
    color: theme.color.textDisabled,
    minWidth: 24,
  },
  headerCopy: {
    flex: 1,
    gap: theme.space.xxs,
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
});
