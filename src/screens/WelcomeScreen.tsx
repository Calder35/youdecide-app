import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { ApiStatusNote } from '../components/ApiStatusNote';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FooterLinks } from '../components/FooterLinks';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { theme } from '../theme';

/** The split that defines the product: the app prepares, a person decides. */
const SPLIT = [
  {
    who: 'You Decide AI does',
    items: [
      'Pulls your property records and finds comparable sales',
      'Drafts your pricing work, prep list, and paperwork',
      'Keeps every document and deadline organized',
      'Shows its sources and how confident it is — every time',
    ],
  },
  {
    who: 'A licensed Nevada agent does',
    items: [
      'Sets the final list price with you',
      'Reviews every offer before you respond',
      'Approves anything that goes public or gets signed',
      'Answers when you tap “Get a human” — from any screen',
    ],
  },
];

export function WelcomeScreen({ navigation }: RootStackScreenProps<'Welcome'>) {
  return (
    <ScreenScaffold
      route={ROUTES.Welcome}
      title="Sell your Nevada home for a 1% listing fee"
      intro="You Decide AI does the preparation. A licensed Nevada agent does the deciding with you. Neither one works without the other."
      actions={
        <Button
          label="Get started"
          testID="cta-continue"
          accessibilityHint="Starts the seller intake with account setup and consent."
          onPress={() => navigation.navigate(ROUTES.AccountConsent)}
        />
      }
    >
      <Card title="What the 1% is" subtitle="The listing-side fee, whole.">
        <AppText>
          One percent of your sale price, and that is the entire listing-side fee. If you choose to
          offer a buyer&rsquo;s agent commission, that is a separate number that you set — we will
          show you exactly how the two add up before you decide anything.
        </AppText>
        <Button
          label="See what the 1% covers"
          variant="secondary"
          testID="cta-see-fee"
          onPress={() => navigation.navigate(ROUTES.OnePercent)}
        />
      </Card>

      {SPLIT.map((column) => (
        <Card key={column.who} title={column.who}>
          {column.items.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <AppText tone="secondary">•</AppText>
              <AppText style={styles.bulletText}>{item}</AppText>
            </View>
          ))}
        </Card>
      ))}

      <ApiStatusNote />

      <Card tone="muted">
        <AppText role="caption" tone="secondary">
          Preview build. No listing can be published from this app, and no production system is
          reachable from it.
        </AppText>
      </Card>

      <FooterLinks />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  bulletText: {
    flex: 1,
  },
});
