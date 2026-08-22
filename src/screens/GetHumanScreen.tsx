import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { ApiStatusNote } from '../components/ApiStatusNote';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/Errors';
import { Field } from '../components/Field';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { NOT_SHARED, buildHandoffPayload, summarizeHandoff } from '../data/handoff';
import { MOCK_PLAN } from '../data/mock';
import { readinessForHuman } from '../data/validation';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';

/**
 * The handoff.
 *
 * The "what transfers" list is BUILT from the same payload chunk 4 will send —
 * see `src/data/handoff.ts`. It is not a hand-written list that can quietly
 * stop matching reality.
 */
export function GetHumanScreen({ navigation, route }: RootStackScreenProps<'GetHuman'>) {
  const { state, requestHuman, propertyAddress } = useSellerSession();
  const { pending } = state.remote;
  const [note, setNote] = useState('');

  const askedFrom = route.params?.from ?? 'Opened directly';
  const payload = buildHandoffPayload(state, {
    askedFrom,
    note,
    propertyAddress,
    plan: MOCK_PLAN,
  });
  const lines = summarizeHandoff(payload);
  const missing = readinessForHuman(state.account);

  const send = async () => {
    // The local record is written first and cannot fail. Whether the test API
    // is reachable changes what STATUS says, never whether the request exists.
    await requestHuman(askedFrom, note);
    navigation.navigate(ROUTES.Status);
  };

  return (
    <ScreenScaffold
      route={ROUTES.GetHuman}
      title="Talk to a licensed Nevada agent"
      intro="Before anything is sent, here is exactly what a person would see."
      actions={
        <>
          <Button
            label="Request a human"
            variant="human"
            testID="cta-request-human"
            busy={pending === 'human'}
            accessibilityHint="Sends everything listed above to a licensed agent."
            onPress={send}
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
      {missing.length > 0 && (
        // Never a blocker. Reaching a human is the one thing this app must not
        // gate — we say what is missing and make it one tap to fix, then let
        // the seller send it anyway if that is what they want.
        <ErrorBanner
          title={`We have no way to reply to you`}
          message={`An agent needs ${missing.join(' and ')} to get back to you. You can add that now, or send this anyway and we will work it out.`}
          testID="handoff-missing-contact"
          action={
            <Button
              label="Add my contact details"
              variant="secondary"
              testID="cta-fix-contact"
              onPress={() => navigation.navigate(ROUTES.AccountConsent)}
            />
          }
        />
      )}

      <Card
        tone="human"
        title="What transfers with this request"
        subtitle="Generated from the actual request, so this list cannot drift from what is sent."
        testID="handoff-manifest"
      >
        {lines.map((line) => (
          <View key={line.label} style={styles.line} testID={`handoff-${slug(line.label)}`}>
            <AppText role="micro" tone="secondary" uppercase>
              {line.label}
            </AppText>
            <AppText>{line.value}</AppText>
          </View>
        ))}
      </Card>

      <Card title="What does not">
        {NOT_SHARED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <AppText role="bodyStrong" tone="danger">
              ✕
            </AppText>
            <AppText style={styles.bulletText}>{item}</AppText>
          </View>
        ))}
      </Card>

      <Card title="Anything you want them to know?">
        <Field
          label="Your note"
          value={note}
          onChangeText={setNote}
          placeholder="I'd like to talk through the price range before I decide anything."
          help="Optional. It goes across with everything above."
          multiline
          testID="field-note"
        />
      </Card>

      <ApiStatusNote />
    </ScreenScaffold>
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const styles = StyleSheet.create({
  line: {
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
