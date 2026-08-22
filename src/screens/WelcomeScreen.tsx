import { Button } from '../components/Button';
import { FooterLinks } from '../components/FooterLinks';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function WelcomeScreen({ navigation }: RootStackScreenProps<'Welcome'>) {
  return (
    <ScreenScaffold
      route={ROUTES.Welcome}
      title="Sell your Nevada home for a 1% listing fee"
      intro="You Decide AI prepares the listing, the pricing work, and the paperwork checklist. A licensed Nevada agent reviews and approves anything that counts."
      actions={
        <Button
          label="Get started"
          testID="cta-continue"
          accessibilityHint="Starts the seller intake with account setup and consent."
          onPress={() => navigation.navigate(ROUTES.AccountConsent)}
        />
      }
    >
      <PlaceholderNote chunk={2}>
        The real welcome copy, the 1% headline, and the &ldquo;what a licensed human does vs. what
        the AI does&rdquo; split land here.
      </PlaceholderNote>
      <FooterLinks />
    </ScreenScaffold>
  );
}
