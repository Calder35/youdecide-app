import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import type { EscalationKind } from '../api/chat';
import { ROUTES } from '../navigation/routes';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export const ESCALATION_TEST_ID = 'escalation-offer';

/**
 * The only way a person enters the conversation.
 *
 * DESIGN RULE, and the reason the old persistent "Get a human" bar is gone:
 * the AI is the experience, not a waiting room in front of a human. A standing
 * "I'd rather talk to a person" button competes with the conversation and
 * quietly tells everyone the AI is the thing to get past.
 *
 * So this renders ONLY when the AI itself has decided a person is needed —
 * driven by the backend's `escalate` field — and it is phrased as accepting
 * something the AI offered, never as an escape hatch from it.
 *
 * `distress` is the exception to the subtlety: when someone is struggling, the
 * offer is clear and immediate, and nothing about property appears next to it.
 */
export function EscalationOffer({
  kind,
  note,
}: {
  kind: EscalationKind;
  note?: string | null;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (kind === 'none') return null;

  const copy = COPY[kind];

  return (
    <View
      style={[styles.container, kind === 'distress' && styles.distress]}
      accessibilityRole={kind === 'distress' ? 'alert' : 'summary'}
      testID={ESCALATION_TEST_ID}
    >
      <AppText role="bodyStrong" tone={kind === 'distress' ? 'primary' : 'human'}>
        {copy.title}
      </AppText>
      <AppText role="body" tone="secondary">
        {note ?? copy.body}
      </AppText>
      {kind === 'distress' && (
        // NOTE: crisis-resource copy needs review before this reaches real
        // users, and localising beyond the US. Kept general on purpose.
        <AppText role="caption" tone="secondary">
          If you are in immediate danger, please contact your local emergency services. In the US
          you can call or text 988 to reach the Suicide &amp; Crisis Lifeline, any time.
        </AppText>
      )}
      <Button
        label={copy.action}
        variant={kind === 'distress' ? 'primary' : 'human'}
        testID="escalation-accept"
        accessibilityHint="Shows what would be shared before anything is sent."
        onPress={() => navigation.navigate(ROUTES.GetHuman, { from: ROUTES.Chat })}
      />
    </View>
  );
}

const COPY: Record<Exclude<EscalationKind, 'none'>, { title: string; body: string; action: string }> = {
  distress: {
    title: "Let's get a person with you",
    body: 'You should not be holding this alone, and I am not the right kind of help for it. Someone here can talk with you now.',
    action: 'Talk with someone now',
  },
  support: {
    title: 'There is someone here when you want them',
    body: 'No rush, and no need to decide anything. If it would help to talk this through with a person who has seen it before, I can bring one in.',
    action: 'Bring someone in',
  },
  licensed: {
    title: 'This one needs a licensed agent',
    body: 'I would rather hand this to someone licensed than answer it myself and be wrong. They will pick it up with everything we have already talked about.',
    action: 'Hand this to an agent',
  },
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.humanSurface,
    borderWidth: 1,
    borderColor: theme.color.human,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  distress: {
    borderWidth: 2,
  },
});
