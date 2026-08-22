import { Button } from '../components/Button';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function SellerDiscoveryScreen({ navigation }: RootStackScreenProps<'SellerDiscovery'>) {
  return (
    <ScreenScaffold
      route={ROUTES.SellerDiscovery}
      title="Tell us about your sale"
      intro="A short set of questions — where the home is, why you're selling, and how soon. Your answers shape the plan and tell the agent what to look at first."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          onPress={() => navigation.navigate(ROUTES.OnePercent)}
        />
      }
    >
      <PlaceholderNote chunk={2}>
        The discovery questions live here — address, timeline, occupancy, motivation — answered
        against mock data first.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
