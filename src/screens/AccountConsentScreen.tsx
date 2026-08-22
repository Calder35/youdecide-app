import { StyleSheet, Text } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Checkbox } from '../components/Checkbox';
import { Field } from '../components/Field';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { CONSENTS, missingRequiredConsents } from '../data/consents';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';

export function AccountConsentScreen({ navigation }: RootStackScreenProps<'AccountConsent'>) {
  const { state, setAccountField, toggleConsent, canProceedPastConsent } = useSellerSession();
  const missing = missingRequiredConsents(state.consents);

  return (
    <ScreenScaffold
      route={ROUTES.AccountConsent}
      title="Your account, and what you're agreeing to"
      intro="Three agreements, each one separate. Two are required to work on a listing. The third is your choice and nothing changes if you decline it."
      actions={
        <>
          {!canProceedPastConsent && (
            <Text style={styles.gate} testID="consent-gate">
              Still needed: {missing.map((consent) => consent.title).join('; ')}
            </Text>
          )}
          <Button
            label="Continue"
            testID="cta-continue"
            disabled={!canProceedPastConsent}
            accessibilityHint={
              canProceedPastConsent
                ? 'Goes on to questions about your sale.'
                : 'Give the required agreements above to continue.'
            }
            onPress={() => navigation.navigate(ROUTES.SellerDiscovery)}
          />
        </>
      }
    >
      <Card title="Your details" subtitle="Used to reach you and to prepare your paperwork.">
        <Field
          label="Full name"
          value={state.account.fullName}
          onChangeText={(value) => setAccountField('fullName', value)}
          placeholder="Jordan Rivera"
          autoCapitalize="words"
          testID="field-fullName"
        />
        <Field
          label="Email"
          value={state.account.email}
          onChangeText={(value) => setAccountField('email', value)}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          testID="field-email"
        />
        <Field
          label="Phone"
          value={state.account.phone}
          onChangeText={(value) => setAccountField('phone', value)}
          placeholder="(702) 555-0143"
          help="A licensed agent uses this to reach you. Nothing automated calls you."
          keyboardType="phone-pad"
          testID="field-phone"
        />
      </Card>

      <Card
        title="What you're agreeing to"
        subtitle="Each is recorded on its own, with the date. You can withdraw any of them later."
      >
        {CONSENTS.map((consent) => (
          <Checkbox
            key={consent.id}
            label={consent.title}
            body={consent.body}
            checked={state.consents[consent.id]}
            requirement={consent.required ? 'required' : 'optional'}
            onToggle={() => toggleConsent(consent.id)}
            testID={`consent-${consent.id}`}
          />
        ))}
      </Card>

      <Card tone="muted">
        <Text style={styles.fine}>
          Preview build — no account is created and nothing is transmitted. In the real app each
          agreement is stored as its own record so it is clear what you agreed to and when.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  gate: {
    ...theme.textStyle.caption,
    color: theme.color.uncertaintyLow,
  },
  fine: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
});
