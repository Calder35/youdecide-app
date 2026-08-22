import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { NOT_SHARED, buildHandoffPayload, summarizeHandoff } from '../data/handoff';
import { MOCK_PLAN } from '../data/mock';
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
  const [note, setNote] = useState('');

  const askedFrom = route.params?.from ?? 'Opened directly';
  const payload = buildHandoffPayload(state, {
    askedFrom,
    note,
    propertyAddress,
    plan: MOCK_PLAN,
  });
  const lines = summarizeHandoff(payload);

  const send = () => {
    requestHuman(askedFrom, note);
    navigation.navigate(ROUTES.Status);
  };

  return (
    <ScreenScaffold
      route={ROUTES.GetHuman}
      title="Talk to a licensed Nevada agent"
      intro="Before anything is sent, here is exactly what a person would see."
      actions={
        <>
          <Button label="Request a human" testID="cta-request-human" onPress={send} />
          <Button
            label="Not now"
            variant="secondary"
            testID="cta-dismiss"
            onPress={() => navigation.goBack()}
          />
        </>
      }
    >
      <Card
        tone="human"
        title="What transfers with this request"
        subtitle="Generated from the actual request, so this list cannot drift from what is sent."
        testID="handoff-manifest"
      >
        {lines.map((line) => (
          <View key={line.label} style={styles.line} testID={`handoff-${slug(line.label)}`}>
            <Text style={styles.lineLabel}>{line.label}</Text>
            <Text style={styles.lineValue}>{line.value}</Text>
          </View>
        ))}
      </Card>

      <Card title="What does not">
        {NOT_SHARED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.never}>✕</Text>
            <Text style={styles.bulletText}>{item}</Text>
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

      <Card tone="muted">
        <Text style={styles.fine}>
          Preview build — nothing is transmitted and no agent is contacted. Chunk 4 sends this exact
          payload to the backend test endpoint and writes the matching audit event.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const styles = StyleSheet.create({
  line: {
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap: theme.space.xxs,
  },
  lineLabel: {
    ...theme.textStyle.micro,
    color: theme.color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  lineValue: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
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
  fine: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
});
