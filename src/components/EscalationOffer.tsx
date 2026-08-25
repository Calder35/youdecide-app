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
 * The professional handoff, and the only card the housing experience shows.
 *
 * THIS IS A HOUSING PRODUCT. Being behind on a mortgage, facing foreclosure, or
 * being unable to afford a payment is an ordinary business situation that the
 * AI handles in discovery — not a crisis, and not a reason to put an emotional
 * card in front of someone. An earlier version treated financial hardship as
 * distress and rendered a suicide-hotline card at a person talking about their
 * mortgage. That is the failure this file is shaped to prevent.
 *
 * So the card here is SERVICE, not sympathy: a specific step needs a licensed
 * teammate, and one will handle it. No emotional language, no crisis copy, no
 * hotline. Genuine self-harm content lives in `SafetyNotice`, is not part of
 * this card, and is gated by the backend to a path the housing flow does not
 * reach.
 *
 * It is still never a standing escape route — it appears only when the backend
 * says a step needs a licensee, and it is phrased as the service doing its job
 * rather than as a way past the AI.
 */
export function EscalationOffer({ kind }: { kind: EscalationKind; note?: string | null }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // `none` shows nothing at all — a clean conversation.
  // `distress` is NOT this card; see SafetyNotice.
  if (kind !== 'licensed' && kind !== 'support') return null;

  return (
    <View style={styles.container} accessibilityRole="summary" testID={ESCALATION_TEST_ID}>
      <AppText role="bodyStrong">A licensed teammate can take this step</AppText>
      <AppText role="body" tone="secondary">
        {/*
          The backend's own note is deliberately NOT rendered here. It is model
          output, and the whole point of this card is that its language is
          guaranteed: professional, service-framed, no emotional register. A
          card whose wording depends on what a model happened to say is not a
          guarantee. The note still travels with the handoff payload for the
          teammate who picks it up — it just does not set the tone on screen.
        */}
        This part needs someone licensed to handle it. They will pick it up with everything we
        have already covered, so you will not need to go over it again.
      </AppText>
      <Button
        label="Hand this step to a teammate"
        variant="secondary"
        testID="escalation-accept"
        accessibilityHint="Shows what would be shared before anything is sent."
        onPress={() => navigation.navigate(ROUTES.GetHuman, { from: ROUTES.Chat })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
});
