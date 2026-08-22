import { AppText } from '../components/AppText';
import { ApiStatusNote } from '../components/ApiStatusNote';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConsentItem } from '../components/ConsentItem';
import { ErrorBanner } from '../components/Errors';
import { Field } from '../components/Field';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { CONSENTS, missingRequiredConsents } from '../data/consents';
import { validateEmail, validateFullName, validatePhone } from '../data/validation';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';

export function AccountConsentScreen({ navigation }: RootStackScreenProps<'AccountConsent'>) {
  const { state, setAccountField, toggleConsent, canProceedPastConsent, submitAccount } =
    useSellerSession();
  const missing = missingRequiredConsents(state.consents);
  const { pending, error, sellerId } = state.remote;

  const goOn = () => navigation.navigate(ROUTES.SellerDiscovery);

  /**
   * Continue creates the seller and records each consent on the test API, then
   * moves on.
   *
   * On failure we STAY on this screen: navigating away would leave the error
   * behind on a screen the seller can no longer see. They are not stuck —
   * "Continue anyway" is right there, because the app works offline by design
   * and a backend problem is not the seller's problem.
   */
  const onContinue = async () => {
    if (await submitAccount()) goOn();
  };

  return (
    <ScreenScaffold
      route={ROUTES.AccountConsent}
      title="Your account, and what you're agreeing to"
      intro="Three agreements, each one separate. Two are required to work on a listing. The third is your choice, and nothing is taken away if you decline it."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          busy={pending === 'account'}
          disabled={!canProceedPastConsent}
          disabledReason={
            canProceedPastConsent
              ? undefined
              : `Still needed: ${missing.map((consent) => consent.title).join('; ')}`
          }
          accessibilityHint="Goes on to questions about your sale."
          onPress={onContinue}
        />
      }
    >
      <ApiStatusNote />

      {error !== null && (
        <ErrorBanner
          title="We could not save your account"
          message={`${error.message} Your answers are safe on this device either way.`}
          testID="account-error"
          action={
            <>
              {error.retryable && (
                <Button
                  label="Try again"
                  variant="secondary"
                  testID="cta-retry-account"
                  onPress={onContinue}
                />
              )}
              <Button
                label="Continue anyway"
                variant="secondary"
                testID="cta-continue-anyway"
                accessibilityHint="Carries on with sample data. Nothing you entered is lost."
                onPress={goOn}
              />
            </>
          }
        />
      )}

      {sellerId !== null && (
        <Card tone="muted" testID="account-saved">
          <AppText role="caption" tone="secondary">
            Saved to the test API. Each agreement you gave was recorded as its own event, with the
            wording you saw.
          </AppText>
        </Card>
      )}

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
