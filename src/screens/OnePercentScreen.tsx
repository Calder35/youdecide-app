import { Button } from '../components/Button';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function OnePercentScreen({ navigation }: RootStackScreenProps<'OnePercent'>) {
  return (
    <ScreenScaffold
      route={ROUTES.OnePercent}
      title="What the 1% covers"
      intro="One listing-side fee, 1% of the sale price. This screen says plainly what that includes, what it doesn't, and what a buyer's agent commission would be on top — before you commit to anything."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          onPress={() => navigation.navigate(ROUTES.PropertyWorkspace)}
        />
      }
    >
      <PlaceholderNote chunk={2}>
        Included vs. excluded, side by side, with a worked example at a real Nevada sale price.
        Non-negotiable: this reads clearly on its own — no disclaimer wall, no fine print doing the
        explaining.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
