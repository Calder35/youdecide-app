import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import {
  CONVENTIONAL_LISTING_RATE,
  EXCLUDED,
  INCLUDED,
  calculateFees,
  formatPercent,
  formatUsd,
} from '../data/fee';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';

const PRICE_STEP = 25000;
const MIN_PRICE = 100000;
const MAX_PRICE = 2000000;

/** What a seller can offer a buyer's agent. Zero is a real, listed option. */
const BUYER_AGENT_OPTIONS = [0, 0.02, 0.025, 0.03];

export function OnePercentScreen({ navigation }: RootStackScreenProps<'OnePercent'>) {
  const { state, setModeledSalePrice, setBuyerAgentRate } = useSellerSession();
  const fees = calculateFees(state.modeledSalePrice, state.buyerAgentRate);

  const adjust = (delta: number) =>
    setModeledSalePrice(Math.min(MAX_PRICE, Math.max(MIN_PRICE, state.modeledSalePrice + delta)));

  return (
    <ScreenScaffold
      route={ROUTES.OnePercent}
      title="What the 1% covers"
      intro="One percent of your sale price is the whole listing-side fee. Here is what that buys, what it does not, and what your sale would actually cost."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          accessibilityHint="Goes on to your property workspace."
          onPress={() => navigation.navigate(ROUTES.PropertyWorkspace)}
        />
      }
    >
      <Card title="Your numbers" subtitle="Move the price to match your home.">
        <View style={styles.priceRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Lower the sale price by ${formatUsd(PRICE_STEP)}`}
            testID="price-down"
            onPress={() => adjust(-PRICE_STEP)}
            style={styles.stepper}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <View style={styles.priceBox}>
            <Text style={styles.price} testID="modeled-price">
              {formatUsd(fees.salePrice)}
            </Text>
            <Text style={styles.priceCaption}>Sale price you&rsquo;re modeling</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Raise the sale price by ${formatUsd(PRICE_STEP)}`}
            testID="price-up"
            onPress={() => adjust(PRICE_STEP)}
            style={styles.stepper}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>You Decide listing fee — 1%</Text>
          <Text style={styles.lineValue} testID="listing-fee">
            {formatUsd(fees.listingFee)}
          </Text>
        </View>
        <Text style={styles.lineNote}>
          This is our entire fee. There is no second listing fee, no transaction fee, no admin fee.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subhead}>
          Buyer&rsquo;s agent commission — your choice, not ours
        </Text>
        <Text style={styles.lineNote}>
          You decide whether to offer one and how much. It is negotiable, and it is separate from
          our 1%.
        </Text>
        <View style={styles.rateRow}>
          {BUYER_AGENT_OPTIONS.map((rate) => {
            const selected = Math.abs(rate - state.buyerAgentRate) < 0.0001;
            return (
              <Pressable
                key={rate}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={
                  rate === 0 ? 'Offer no buyer agent commission' : `Offer ${formatPercent(rate)}`
                }
                testID={`buyer-rate-${Math.round(rate * 1000)}`}
                onPress={() => setBuyerAgentRate(rate)}
                style={[styles.rateChip, selected && styles.rateChipSelected]}
              >
                <Text style={[styles.rateText, selected && styles.rateTextSelected]}>
                  {rate === 0 ? 'None' : formatPercent(rate)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>
            Buyer&rsquo;s agent — {formatPercent(fees.buyerAgentRate)}
          </Text>
          <Text style={styles.lineValue} testID="buyer-agent-fee">
            {formatUsd(fees.buyerAgentFee)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.lineItem}>
          <Text style={styles.totalLabel}>What you pay in commission</Text>
          <Text style={styles.totalValue} testID="total-commission">
            {formatUsd(fees.totalCommission)}
          </Text>
        </View>
        <Text style={styles.lineNote}>
          {formatPercent(fees.effectiveRate)} of your sale price, both sides together.
        </Text>
      </Card>

      <Card
        title="For comparison"
        subtitle={`A conventional listing side is often around ${formatPercent(CONVENTIONAL_LISTING_RATE)}.`}
        tone="muted"
      >
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>
            Listing side at {formatPercent(CONVENTIONAL_LISTING_RATE)}
          </Text>
          <Text style={styles.lineValue}>{formatUsd(fees.conventionalListingFee)}</Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Listing side with You Decide</Text>
          <Text style={styles.lineValue}>{formatUsd(fees.listingFee)}</Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.totalLabel}>Difference</Text>
          <Text style={styles.totalValue} testID="savings">
            {formatUsd(fees.savingsVsConventional)}
          </Text>
        </View>
        <Text style={styles.lineNote}>
          A comparison at a common rate, not a claim about what any particular brokerage charges.
          Commission rates are always negotiable.
        </Text>
      </Card>

      <Card title="What the 1% includes">
        {INCLUDED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.included}>✓</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </Card>

      <Card title="What it does not">
        {EXCLUDED.map((entry) => (
          <View key={entry.item} style={styles.excludedBlock}>
            <View style={styles.bulletRow}>
              <Text style={styles.excluded}>—</Text>
              <Text style={styles.bulletText}>{entry.item}</Text>
            </View>
            <Text style={styles.excludedNote}>{entry.note}</Text>
          </View>
        ))}
      </Card>

      <Card tone="human" title="Not sure how this applies to your sale?">
        <Text style={styles.bulletText}>
          A licensed Nevada agent will walk through your actual numbers with you before you commit
          to anything. Tap &ldquo;Get a human&rdquo; below — it is on every screen.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  stepper: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    ...theme.textStyle.heading,
    color: theme.color.actionPrimary,
  },
  priceBox: {
    flex: 1,
    alignItems: 'center',
  },
  price: theme.textStyle.display,
  priceCaption: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.space.md,
  },
  lineLabel: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
    flex: 1,
  },
  lineValue: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  lineNote: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  subhead: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.color.border,
    marginVertical: theme.space.xs,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  rateChip: {
    minHeight: theme.hitTarget.min,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  rateChipSelected: {
    borderColor: theme.color.actionPrimary,
    backgroundColor: theme.color.sourceSurface,
  },
  rateText: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  rateTextSelected: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.actionPrimaryPressed,
  },
  totalLabel: {
    ...theme.textStyle.subheading,
    color: theme.color.textPrimary,
    flex: 1,
  },
  totalValue: theme.textStyle.subheading,
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  bulletText: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
    flex: 1,
  },
  included: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.uncertaintyHigh,
  },
  excluded: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textSecondary,
  },
  excludedBlock: {
    gap: theme.space.xxs,
    marginBottom: theme.space.sm,
  },
  excludedNote: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
    marginLeft: theme.space.lg,
  },
});
