import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DraftNotice } from '../components/DraftNotice';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { nv } from '../content/nevada';
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
    // Nevada-specific claim — DRAFT, see src/content/nevada.ts.
    why: nv('recordRetention'),
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
              variant="danger"
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
            variant="secondary"
            testID="cta-request-delete"
            onPress={() => setConfirming(true)}
          />
        )
      }
    >
      <Card title="What gets deleted">
        {REMOVED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <AppText role="bodyStrong" tone="danger">
              ✕
            </AppText>
            <AppText style={styles.bulletText}>{item}</AppText>
          </View>
        ))}
        <AppText role="caption" tone="secondary">
          Within 30 days of your request.
        </AppText>
      </Card>

      <Card title="What we have to keep, and why">
        <DraftNotice />
        {RETAINED.map((entry) => (
          <View key={entry.what} style={styles.entry}>
            <AppText role="bodyStrong">{entry.what}</AppText>
            <AppText role="caption" tone="secondary">
              {entry.why}
            </AppText>
          </View>
        ))}
      </Card>

      <Card tone="human" title="A person handles this">
        <AppText>
          Deletion is a high-consequence action, so it follows the same rule as everything else
          here: a licensed human confirms it with you first, and tells you what will remain.
        </AppText>
      </Card>

      {confirming && (
        <Card tone="muted" testID="delete-preview-note">
          <AppText role="caption" tone="secondary">
            Preview build — no account exists, so nothing will be deleted and nothing is sent.
          </AppText>
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
  bulletText: {
    flex: 1,
  },
  entry: {
    paddingVertical: theme.space.sm,
    gap: theme.space.xxs,
  },
});
