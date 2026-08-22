import { Button } from '../components/Button';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function AccountConsentScreen({ navigation }: RootStackScreenProps<'AccountConsent'>) {
  return (
    <ScreenScaffold
      route={ROUTES.AccountConsent}
      title="Your account and what you're agreeing to"
      intro="Create an account, then read the two things we need your consent for. Each one is separate — you can decline either and still keep looking around."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          onPress={() => navigation.navigate(ROUTES.SellerDiscovery)}
        />
      }
    >
      <PlaceholderNote chunk={2}>
        Sign-up fields and the consent checkboxes go here. Chunk 3 replaces them with the real
        disclosure UI; chunk 4 posts them to the backend test API (create seller, then record
        consent as its own audited event).
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
