import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { theme } from '../theme';

const REMOVED = [
  'Your account and sign-in',
  'Your contact details',
  'Your discovery answers and any notes you wrote',
  'Property facts and documents in your workspace',
  'Your listing plan',
];

const RETAINED = [
  {
    what: 'Records tied to a completed transaction',
    why: 'Nevada requires a brokerage to retain transaction records. Your escrow and closing paperwork is part of that.',
  },
  {
    what: 'Your consent record',
    why: 'The proof of what you agreed to and when. Deleting it would remove the record protecting you.',
  },
];

export function DeleteAccountScreen({ navigation }: RootStackScreenProps<'DeleteAccount'>) {
  const [confirming, setConfirming] = useState(false);

  return (
    <ScreenScaffold
      route={ROUTES.DeleteAccount}
      title="Delete your account"
      intro="What deletion removes, what has to stay, and how long it takes. No retention traps."
      actions={
        confirming ? (
          <>
            <Button
              label="Yes, request deletion"
              testID="cta-confirm-delete"
              accessibilityHint="In this preview build nothing is deleted and nothing is sent."
              onPress={() => navigation.navigate(ROUTES.Status)}
            />
            <Button
              label="Cancel"
              variant="secondary"
              testID="cta-cancel-delete"
              onPress={() => setConfirming(false)}
            />
          </>
        ) : (
          <Button
            label="Request account deletion"
            testID="cta-request-delete"
            onPress={() => setConfirming(true)}
          />
        )
      }
    >
      <Card title="What gets deleted">
        {REMOVED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.removed}>✕</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
        <Text style={styles.note}>Within 30 days of your request.</Text>
      </Card>

      <Card title="What we have to keep, and why">
        {RETAINED.map((entry) => (
          <View key={entry.what} style={styles.entry}>
            <Text style={styles.what}>{entry.what}</Text>
            <Text style={styles.note}>{entry.why}</Text>
          </View>
        ))}
      </Card>

      <Card tone="human" title="A person handles this">
        <Text style={styles.bulletText}>
          Deletion is a high-consequence action, so it follows the same rule as everything else
          here: a licensed human confirms it with you first, and tells you what will remain.
        </Text>
      </Card>

      {confirming && (
        <Card tone="muted" testID="delete-preview-note">
          <Text style={styles.note}>
            Preview build — no account exists, so nothing will be deleted and nothing is sent.
          </Text>
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  removed: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.uncertaintyLow,
  },
  bulletText: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
    flex: 1,
  },
  entry: {
    paddingVertical: theme.space.sm,
    gap: theme.space.xxs,
  },
  what: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  note: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
});
