import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConsentItem } from '../components/ConsentItem';
import { Field } from '../components/Field';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { CONSENTS, missingRequiredConsents } from '../data/consents';
import { validateEmail, validateFullName, validatePhone } from '../data/validation';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';

export function AccountConsentScreen({ navigation }: RootStackScreenProps<'AccountConsent'>) {
  const { state, setAccountField, toggleConsent, canProceedPastConsent } = useSellerSession();
  const missing = missingRequiredConsents(state.consents);

  return (
    <ScreenScaffold
      route={ROUTES.AccountConsent}
      title="Your account, and what you're agreeing to"
      intro="Three agreements, each one separate. Two are required to work on a listing. The third is your choice, and nothing is taken away if you decline it."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          disabled={!canProceedPastConsent}
          disabledReason={
            canProceedPastConsent
              ? undefined
              : `Still needed: ${missing.map((consent) => consent.title).join('; ')}`
          }
          accessibilityHint="Goes on to questions about your sale."
          onPress={() => navigation.navigate(ROUTES.SellerDiscovery)}
        />
      }
    >
      <Card title="Your details" subtitle="Used to reach you and to prepare your paperwork.">
        <Field
          label="Full name"
          value={state.account.fullName}
          onChangeText={(value) => setAccountField('fullName', value)}
          validate={validateFullName}
          placeholder="Jordan Rivera"
          autoCapitalize="words"
          autoComplete="name"
          testID="field-fullName"
        />
        <Field
          label="Email"
          value={state.account.email}
          onChangeText={(value) => setAccountField('email', value)}
          validate={validateEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="field-email"
        />
        <Field
          label="Phone"
          value={state.account.phone}
          onChangeText={(value) => setAccountField('phone', value)}
          validate={validatePhone}
          placeholder="(702) 555-0143"
          help="A licensed agent uses this to reach you. Nothing automated calls you."
          keyboardType="phone-pad"
          autoComplete="tel"
          testID="field-phone"
        />
      </Card>

      <Card
        title="What you're agreeing to"
        subtitle="Each is recorded on its own, with the date. You can withdraw any of them later."
      >
        {CONSENTS.map((consent) => (
          <ConsentItem
            key={consent.id}
            consent={consent}
            checked={state.consents[consent.id]}
            onToggle={() => toggleConsent(consent.id)}
            testID={`consent-${consent.id}`}
          />
        ))}
      </Card>

      <Card tone="muted">
        <AppText role="caption" tone="secondary">
          Preview build — no account is created and nothing is transmitted. In the real app each
          agreement is stored as its own record so it is clear what you agreed to and when.
        </AppText>
      </Card>
    </ScreenScaffold>
  );
}
