import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DraftNotice } from '../components/DraftNotice';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { nv } from '../content/nevada';
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
    why: 'So it is always clear what you agreed to.',
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
            <AppText role="bodyStrong">{entry.what}</AppText>
            <AppText role="caption" tone="secondary">
              {entry.why}
            </AppText>
          </View>
        ))}
      </Card>

      <Card title="What we never take">
        {NOT_SHARED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <AppText role="bodyStrong" tone="danger">
              ✕
            </AppText>
            <AppText style={styles.bulletText}>{item}</AppText>
          </View>
        ))}
        <AppText role="caption" tone="secondary">
          We do not sell your information. Not to anyone, ever.
        </AppText>
      </Card>

      <Card title="Who sees it">
        <AppText>
          The licensed Nevada agents working on your sale, and the staff who support them. When you
          ask for a human, the handoff screen lists exactly what goes across before it does.
        </AppText>
      </Card>

      <Card title="Getting rid of it">
        <AppText>You can delete your account and ask us to erase your data at any time.</AppText>
        <AppText>{nv('recordRetention')}</AppText>
        <DraftNotice />
        <Button
          label="Delete your account"
          variant="secondary"
          testID="cta-delete-account"
          onPress={() => navigation.navigate(ROUTES.DeleteAccount)}
        />
      </Card>

      <Card tone="muted">
        <AppText role="caption" tone="secondary">
          Preview build. This describes how the product is designed to work; the binding privacy
          policy ships with the real release.
        </AppText>
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
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  bulletText: {
    flex: 1,
  },
});
