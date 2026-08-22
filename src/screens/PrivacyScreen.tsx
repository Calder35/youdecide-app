import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { NOT_SHARED } from '../data/handoff';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { theme } from '../theme';

const COLLECTED = [
  {
    what: 'Your name, email, and phone',
    why: 'So a licensed agent can reach you about your sale.',
  },
  {
    what: 'Your property address and your answers about the sale',
    why: 'To pull public records and prepare your listing and paperwork.',
  },
  {
    what: 'Public property records for that address',
    why: 'Assessor and recorded-sale data. Public before we touched it.',
  },
  {
    what: 'Your consent record — which agreements, and when',
    why: 'So it is always clear what you agreed to. Kept as long as the law requires.',
  },
];

export function PrivacyScreen({ navigation }: RootStackScreenProps<'Privacy'>) {
  return (
    <ScreenScaffold
      route={ROUTES.Privacy}
      title="Privacy & your data"
      intro="What we collect, why, who sees it, and how to get rid of it. Same plain language as the rest of the app."
    >
      <Card title="What we collect, and why">
        {COLLECTED.map((entry) => (
          <View key={entry.what} style={styles.entry}>
            <Text style={styles.what}>{entry.what}</Text>
            <Text style={styles.why}>{entry.why}</Text>
          </View>
        ))}
      </Card>

      <Card title="What we never take">
        {NOT_SHARED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.never}>✕</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
        <Text style={styles.why}>We do not sell your information. Not to anyone, ever.</Text>
      </Card>

      <Card title="Who sees it">
        <Text style={styles.bulletText}>
          The licensed Nevada agents working on your sale, and the staff who support them. When you
          ask for a human, the handoff screen lists exactly what goes across before it does.
        </Text>
      </Card>

      <Card title="Getting rid of it">
        <Text style={styles.bulletText}>
          You can delete your account and ask us to erase your data at any time. Some records tied
          to a real estate transaction have to be retained under Nevada law — the deletion screen
          says which, and for how long.
        </Text>
        <Button
          label="Delete your account"
          variant="secondary"
          testID="cta-delete-account"
          onPress={() => navigation.navigate(ROUTES.DeleteAccount)}
        />
      </Card>

      <Card tone="muted">
        <Text style={styles.why}>
          Preview build. This describes how the product is designed to work; the binding privacy
          policy ships with the real release.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  entry: {
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap: theme.space.xxs,
  },
  what: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  why: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  never: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.uncertaintyLow,
  },
  bulletText: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
    flex: 1,
  },
});
