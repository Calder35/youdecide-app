import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { Field } from '../components/Field';
import { DraftNotice } from '../components/DraftNotice';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { nv } from '../content/nevada';
import { OCCUPANCY_CHOICES, TIMELINE_CHOICES } from '../data/types';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';

export function SellerDiscoveryScreen({ navigation }: RootStackScreenProps<'SellerDiscovery'>) {
  const { state, setDiscoveryField } = useSellerSession();
  const { discovery } = state;

  return (
    <ScreenScaffold
      route={ROUTES.SellerDiscovery}
      title="Tell us about your sale"
      intro="Six questions. Your answers shape the plan, and they are the first thing a licensed agent reads when you ask for one."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          accessibilityHint="Goes on to the 1% fee explanation."
          onPress={() => navigation.navigate(ROUTES.OnePercent)}
        />
      }
    >
      <Card title="The home" subtitle="Leave it blank to keep exploring with our sample property.">
        <Field
          label="Street address"
          value={discovery.addressLine}
          onChangeText={(value) => setDiscoveryField('addressLine', value)}
          placeholder="4821 Desert Willow Ct"
          autoCapitalize="words"
          testID="field-addressLine"
        />
        <Field
          label="City"
          value={discovery.city}
          onChangeText={(value) => setDiscoveryField('city', value)}
          placeholder="Las Vegas"
          autoCapitalize="words"
          testID="field-city"
        />
        <Field
          label="ZIP code"
          value={discovery.zip}
          onChangeText={(value) => setDiscoveryField('zip', value)}
          placeholder="89129"
          keyboardType="number-pad"
          testID="field-zip"
        />
      </Card>

      <Card title="Your timing">
        <ChoiceGroup
          label="When would you like to sell?"
          options={TIMELINE_CHOICES}
          value={discovery.timeline}
          onChange={(value) => setDiscoveryField('timeline', value)}
          testIDPrefix="timeline"
        />
        <AppText role="caption" tone="secondary">
          &ldquo;Just exploring&rdquo; is a real answer. Nothing here commits you to listing.
        </AppText>
      </Card>

      <Card title="Who's in the home">
        <ChoiceGroup
          label="Occupancy"
          options={OCCUPANCY_CHOICES}
          value={discovery.occupancy}
          onChange={(value) => setDiscoveryField('occupancy', value)}
          testIDPrefix="occupancy"
        />
        <AppText role="caption" tone="secondary">
          {nv('tenantOccupied')}
        </AppText>
        <DraftNotice />
      </Card>

      <Card title="Your reason">
        <Field
          label="Why are you selling?"
          value={discovery.reason}
          onChangeText={(value) => setDiscoveryField('reason', value)}
          placeholder="Relocating for work in the spring"
          help="In your own words. It tells an agent what matters most — speed, price, or certainty."
          multiline
          testID="field-reason"
        />
      </Card>
    </ScreenScaffold>
  );
}
