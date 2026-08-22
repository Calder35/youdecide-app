import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DraftNotice } from '../components/DraftNotice';
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
            <AppText role="heading" tone="action">
              −
            </AppText>
          </Pressable>
          <View style={styles.priceBox}>
            <AppText role="display" testID="modeled-price">
              {formatUsd(fees.salePrice)}
            </AppText>
            <AppText role="caption" tone="secondary">
              Sale price you&rsquo;re modeling
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Raise the sale price by ${formatUsd(PRICE_STEP)}`}
            testID="price-up"
            onPress={() => adjust(PRICE_STEP)}
            style={styles.stepper}
          >
            <AppText role="heading" tone="action">
              +
            </AppText>
          </Pressable>
        </View>

        <View style={styles.lineItem}>
          <AppText style={styles.lineLabel}>You Decide listing fee — 1%</AppText>
          <AppText role="bodyStrong" testID="listing-fee">
            {formatUsd(fees.listingFee)}
          </AppText>
        </View>
        <AppText role="caption" tone="secondary">
          This is our entire fee. There is no second listing fee, no transaction fee, no admin fee.
        </AppText>

        <View style={styles.divider} />

        <AppText role="bodyStrong">Buyer&rsquo;s agent commission — your choice, not ours</AppText>
        <AppText role="caption" tone="secondary">
          You decide whether to offer one and how much. It is negotiable, and it is separate from
          our 1%.
        </AppText>
        <View style={styles.rateRow} accessibilityRole="radiogroup">
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
                <AppText
                  role={selected ? 'bodyStrong' : 'body'}
                  tone={selected ? 'action' : 'primary'}
                >
                  {rate === 0 ? 'None' : formatPercent(rate)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.lineItem}>
          <AppText style={styles.lineLabel}>
            Buyer&rsquo;s agent — {formatPercent(fees.buyerAgentRate)}
          </AppText>
          <AppText role="bodyStrong" testID="buyer-agent-fee">
            {formatUsd(fees.buyerAgentFee)}
          </AppText>
        </View>

        <View style={styles.divider} />

        <View style={styles.lineItem}>
          <AppText role="subheading" style={styles.lineLabel}>
            What you pay in commission
          </AppText>
          <AppText role="subheading" testID="total-commission">
            {formatUsd(fees.totalCommission)}
          </AppText>
        </View>
        <AppText role="caption" tone="secondary">
          {formatPercent(fees.effectiveRate)} of your sale price, both sides together.
        </AppText>
      </Card>

      <Card
        title="For comparison"
        subtitle={`A conventional listing side is often around ${formatPercent(CONVENTIONAL_LISTING_RATE)}.`}
        tone="muted"
      >
        <View style={styles.lineItem}>
          <AppText style={styles.lineLabel}>
            Listing side at {formatPercent(CONVENTIONAL_LISTING_RATE)}
          </AppText>
          <AppText role="bodyStrong">{formatUsd(fees.conventionalListingFee)}</AppText>
        </View>
        <View style={styles.lineItem}>
          <AppText style={styles.lineLabel}>Listing side with You Decide</AppText>
          <AppText role="bodyStrong">{formatUsd(fees.listingFee)}</AppText>
        </View>
        <View style={styles.lineItem}>
          <AppText role="subheading" style={styles.lineLabel}>
            Difference
          </AppText>
          <AppText role="subheading" testID="savings">
            {formatUsd(fees.savingsVsConventional)}
          </AppText>
        </View>
        <AppText role="caption" tone="secondary">
          A comparison at a common rate, not a claim about what any particular brokerage charges.
          Commission rates are always negotiable.
        </AppText>
      </Card>

      <Card title="What the 1% includes">
        {INCLUDED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <AppText role="bodyStrong" tone="success">
              ✓
            </AppText>
            <AppText style={styles.bulletText}>{item}</AppText>
          </View>
        ))}
      </Card>

      <Card title="What it does not">
        {EXCLUDED.map((entry) => (
          <View key={entry.item} style={styles.excludedBlock}>
            <View style={styles.bulletRow}>
              <AppText role="bodyStrong" tone="secondary">
                —
              </AppText>
              <AppText style={styles.bulletText}>{entry.item}</AppText>
            </View>
            <AppText role="caption" tone="secondary" style={styles.excludedNote}>
              {entry.note}
            </AppText>
          </View>
        ))}
        <DraftNotice />
      </Card>

      <Card tone="human" title="Not sure how this applies to your sale?">
        <AppText>
          A licensed Nevada agent will walk through your actual numbers with you before you commit
          to anything. Tap &ldquo;Get a human&rdquo; below — it is on every screen.
        </AppText>
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
  priceBox: {
    flex: 1,
    alignItems: 'center',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.space.md,
  },
  lineLabel: {
    flex: 1,
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
    borderColor: theme.color.controlBorder,
  },
  rateChipSelected: {
    borderColor: theme.color.actionPrimary,
    backgroundColor: theme.color.sourceSurface,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  bulletText: {
    flex: 1,
  },
  excludedBlock: {
    gap: theme.space.xxs,
    marginBottom: theme.space.sm,
  },
  excludedNote: {
    marginLeft: theme.space.lg,
  },
});
