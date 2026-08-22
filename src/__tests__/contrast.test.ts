import { color } from '../theme';
import { AA_NON_TEXT, AA_NORMAL, contrastRatio } from '../theme/contrast';

/**
 * Accessibility as a build gate.
 *
 * Every text/background pairing the app actually renders is listed here. If a
 * color token changes and a pairing drops below the WCAG AA threshold, this
 * fails — so the app cannot quietly become unreadable between releases.
 */

type Pair = { name: string; fg: string; bg: string };

const TEXT_PAIRS: Pair[] = [
  { name: 'body text on the app background', fg: color.textPrimary, bg: color.background },
  { name: 'body text on a card', fg: color.textPrimary, bg: color.surface },
  { name: 'secondary text on a card', fg: color.textSecondary, bg: color.surface },
  { name: 'secondary text on the app background', fg: color.textSecondary, bg: color.background },
  { name: 'secondary text on a muted card', fg: color.textSecondary, bg: color.surfaceMuted },
  { name: 'placeholder text in an input', fg: color.textPlaceholder, bg: color.surface },
  { name: 'primary button label', fg: color.actionPrimaryText, bg: color.actionPrimary },
  { name: 'primary button label, pressed', fg: color.actionPrimaryText, bg: color.actionPrimaryPressed },
  { name: 'secondary button label', fg: color.actionSecondaryText, bg: color.surface },
  { name: 'get-a-human label on its surface', fg: color.humanPressed, bg: color.humanSurface },
  { name: 'get-a-human label on a card', fg: color.humanPressed, bg: color.surface },
  { name: 'body text on a human-toned card', fg: color.textPrimary, bg: color.humanSurface },
  { name: 'secondary text on a human-toned card', fg: color.textSecondary, bg: color.humanSurface },
  { name: 'high-confidence label on a card', fg: color.uncertaintyHigh, bg: color.surface },
  { name: 'medium-confidence label on a card', fg: color.uncertaintyMedium, bg: color.surface },
  { name: 'low-confidence label on a card', fg: color.uncertaintyLow, bg: color.surface },
  { name: 'error text on a card', fg: color.uncertaintyLow, bg: color.surface },
  { name: 'error text on its own surface', fg: color.uncertaintyLow, bg: color.uncertaintyLowSurface },
  { name: 'source label on its surface', fg: color.source, bg: color.sourceSurface },
];

/** Boundaries a person has to be able to see to use the control. */
const NON_TEXT_PAIRS: Pair[] = [
  { name: 'input border on a card', fg: color.controlBorder, bg: color.surface },
  { name: 'input border on the app background', fg: color.controlBorder, bg: color.background },
  { name: 'checked checkbox against a card', fg: color.actionPrimary, bg: color.surface },
  { name: 'get-a-human border on its surface', fg: color.human, bg: color.humanSurface },
];

describe('color contrast (WCAG 2.2 AA)', () => {
  it.each(TEXT_PAIRS)('$name reaches 4.5:1', ({ fg, bg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(NON_TEXT_PAIRS)('$name reaches 3:1', ({ fg, bg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('computes known ratios correctly', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Order does not matter.
    expect(contrastRatio('#1C6FB0', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#1C6FB0'),
      10,
    );
  });

  it('rejects a malformed color rather than scoring it', () => {
    expect(() => contrastRatio('not-a-color', '#FFFFFF')).toThrow(/6-digit hex/);
  });
});
