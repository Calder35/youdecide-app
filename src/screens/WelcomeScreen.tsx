import { StyleSheet, Text, View } from 'react-native';

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
        <Text style={styles.body}>
          One percent of your sale price, and that is the entire listing-side fee. If you choose to
          offer a buyer&rsquo;s agent commission, that is a separate number that you set — we will
          show you exactly how the two add up before you decide anything.
        </Text>
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
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </Card>
      ))}

      <Card tone="muted">
        <Text style={styles.fine}>
          Preview build. Nothing you enter here is sent anywhere, and no listing can be published
          from this app.
        </Text>
      </Card>

      <FooterLinks />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  bulletMark: {
    ...theme.textStyle.body,
    color: theme.color.textSecondary,
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
