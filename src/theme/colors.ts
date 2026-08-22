/**
 * Color tokens.
 *
 * Two layers on purpose:
 *   - `palette` — raw values. Never reference these from a screen.
 *   - `color`   — semantic roles. Screens and components use ONLY these, so a
 *                 palette change (or a future dark theme) is a one-file edit.
 *
 * Trust roles (`source`, `uncertainty*`, `human`) exist from the scaffold on
 * because the product principle — always show where a number came from and how
 * confident we are — is not a late-stage skin. Chunk 3 builds the components;
 * the vocabulary is reserved here.
 */

const palette = {
  ink900: '#0F1720',
  ink700: '#2B3948',
  ink500: '#5A6B7C',
  // The lightest ink that still clears 3:1 — the WCAG floor for a control
  // boundary. Input and control borders use it; card hairlines do not need it.
  ink350: '#7C8B9B',
  ink300: '#93A2B1',
  ink100: '#D8E0E8',
  ink050: '#EEF2F6',
  white: '#FFFFFF',

  // Desert-dusk blue — primary brand action.
  blue700: '#12507F',
  blue500: '#1C6FB0',
  blue100: '#DCEBF7',

  // Human-in-the-loop accent. Deliberately warm so "get a human" never reads
  // as just another blue button.
  clay600: '#A8501E',
  clay500: '#C86A2E',
  clay100: '#FAE7D9',

  green600: '#1E7A46',
  green100: '#DCF2E5',
  amber600: '#9A6400',
  amber100: '#FBEFD2',
  red600: '#A32020',
  red100: '#F8DEDE',
} as const;

export const color = {
  // Surfaces
  background: palette.ink050,
  surface: palette.white,
  surfaceMuted: palette.ink050,
  /** Hairlines between rows and around cards — decorative, not a boundary. */
  border: palette.ink100,
  /** The edge of an input, checkbox, or chip. Must stay >= 3:1 (WCAG 1.4.11). */
  controlBorder: palette.ink350,

  // Text
  textPrimary: palette.ink900,
  textSecondary: palette.ink500,
  textInverse: palette.white,
  /** Placeholder text is text: it is held to 4.5:1 like any other. */
  textPlaceholder: palette.ink500,
  /**
   * Disabled controls only. WCAG exempts disabled elements from contrast, and
   * this is the one token allowed to fall below it — never use it for text a
   * person is meant to read.
   */
  textDisabled: palette.ink300,

  // Primary action
  actionPrimary: palette.blue500,
  actionPrimaryPressed: palette.blue700,
  actionPrimaryText: palette.white,
  actionSecondaryBorder: palette.ink100,
  actionSecondaryText: palette.blue700,

  // Human-in-the-loop ("get a human" is never a plain link)
  human: palette.clay500,
  humanPressed: palette.clay600,
  humanSurface: palette.clay100,

  // Provenance / confidence (chunk 3 UI, reserved here)
  source: palette.blue700,
  sourceSurface: palette.blue100,
  uncertaintyHigh: palette.green600, // high confidence
  uncertaintyHighSurface: palette.green100,
  uncertaintyMedium: palette.amber600,
  uncertaintyMediumSurface: palette.amber100,
  uncertaintyLow: palette.red600,
  uncertaintyLowSurface: palette.red100,

  // Focus ring — accessibility, not decoration.
  focus: palette.blue700,
} as const;

export type ColorToken = keyof typeof color;
