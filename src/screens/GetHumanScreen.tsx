import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { theme } from '../theme';

/**
 * The handoff. Nothing is sent from this screen in chunk 1 — it exists so the
 * "what transfers" disclosure is part of the shell from day one rather than a
 * modal bolted on later.
 */
export function GetHumanScreen({ navigation, route }: RootStackScreenProps<'GetHuman'>) {
  const from = route.params?.from;

  return (
    <ScreenScaffold
      route={ROUTES.GetHuman}
      title="Talk to a licensed Nevada agent"
      intro="Before anything is sent, here is exactly what a person would see."
      actions={
        <>
          <Button
            label="Request a human"
            testID="cta-request-human"
            accessibilityHint="In this preview build nothing is sent. Chunk 4 connects this to the test API."
            onPress={() => navigation.navigate(ROUTES.Status)}
          />
          <Button
            label="Not now"
            variant="secondary"
            testID="cta-dismiss"
            onPress={() => navigation.goBack()}
          />
        </>
      }
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What transfers with this request</Text>
        <Text style={styles.item}>&bull; Your name and contact details</Text>
        <Text style={styles.item}>&bull; The property address and the facts in your workspace</Text>
        <Text style={styles.item}>&bull; Your answers from seller discovery</Text>
        <Text style={styles.item}>&bull; The current AI plan, with its sources</Text>
        <Text style={styles.item}>
          &bull; Where you asked from: {from ?? 'not recorded — opened directly'}
        </Text>
        <Text style={styles.footnote}>
          Nothing else. This list is generated from the actual payload in chunk 4, so it cannot
          drift from what is really sent.
        </Text>
      </View>
      <PlaceholderNote chunk={4}>
        In this build the request is not sent anywhere. Chunk 4 posts it to the backend test
        endpoint and writes the matching audit event.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.humanSurface,
    borderWidth: 1,
    borderColor: theme.color.human,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.xs,
  },
  cardTitle: {
    ...theme.textStyle.subheading,
    color: theme.color.textPrimary,
  },
  item: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  footnote: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
  },
});
