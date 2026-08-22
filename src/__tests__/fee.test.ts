import {
  CONVENTIONAL_LISTING_RATE,
  EXCLUDED,
  INCLUDED,
  LISTING_FEE_RATE,
  calculateFees,
  formatPercent,
  formatUsd,
} from '../data/fee';

describe('the 1% fee', () => {
  it('charges exactly 1% of the sale price on the listing side', () => {
    expect(LISTING_FEE_RATE).toBe(0.01);
    expect(calculateFees(450000, 0).listingFee).toBe(4500);
    expect(calculateFees(1000000, 0).listingFee).toBe(10000);
  });

  it("keeps the buyer's agent commission separate from our fee", () => {
    const fees = calculateFees(450000, 0.025);
    expect(fees.listingFee).toBe(4500);
    expect(fees.buyerAgentFee).toBe(11250);
    // The listing fee does not absorb, discount, or hide the buyer side.
    expect(fees.totalCommission).toBe(fees.listingFee + fees.buyerAgentFee);
  });

  it('lets a seller offer nothing to a buyer agent', () => {
    const fees = calculateFees(450000, 0);
    expect(fees.buyerAgentFee).toBe(0);
    expect(fees.totalCommission).toBe(fees.listingFee);
    expect(fees.effectiveRate).toBeCloseTo(0.01, 10);
  });

  it('reports the true effective rate across both sides', () => {
    const fees = calculateFees(600000, 0.03);
    expect(fees.effectiveRate).toBeCloseTo(0.04, 10);
    expect(formatPercent(fees.effectiveRate)).toBe('4%');
  });

  it('compares against a conventional listing rate without touching our fee', () => {
    const fees = calculateFees(500000);
    expect(fees.conventionalListingFee).toBe(500000 * CONVENTIONAL_LISTING_RATE);
    expect(fees.savingsVsConventional).toBe(fees.conventionalListingFee - fees.listingFee);
    expect(fees.listingFee).toBe(5000);
  });

  it('treats junk input as zero rather than rendering NaN at a seller', () => {
    expect(calculateFees(Number.NaN).salePrice).toBe(0);
    expect(calculateFees(-100).listingFee).toBe(0);
    expect(calculateFees(450000, Number.NaN).buyerAgentFee).toBe(0);
    expect(calculateFees(0).effectiveRate).toBe(0);
  });

  it('formats money in whole dollars', () => {
    expect(formatUsd(4500)).toBe('$4,500');
    expect(formatUsd(11250.4)).toBe('$11,250');
  });

  it('names both what the fee includes and what it does not', () => {
    expect(INCLUDED.length).toBeGreaterThanOrEqual(5);
    expect(EXCLUDED.length).toBeGreaterThanOrEqual(5);
    // Every exclusion explains itself — an unexplained "not included" is the
    // disclaimer wall we are avoiding.
    expect(EXCLUDED.every((entry) => entry.note.trim().length > 20)).toBe(true);
  });

  it("names the buyer's agent commission as the first thing excluded", () => {
    expect(EXCLUDED[0].item).toMatch(/buyer's agent commission/i);
  });
});
