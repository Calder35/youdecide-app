/**
 * WCAG contrast math.
 *
 * Here so accessibility is a property the tokens are TESTED against, not a
 * thing someone eyeballs once. `contrast.test.ts` walks every text/background
 * pair the app actually uses and fails the build if one drops below the
 * threshold — which is why a color change cannot quietly make the app harder
 * to read.
 */

/** WCAG 2.2 AA: normal text. */
export const AA_NORMAL = 4.5;
/** WCAG 2.2 AA: large text (>= 18pt bold, or >= 24pt). */
export const AA_LARGE = 3;
/** WCAG 2.2 AA: UI component boundaries and meaningful graphics. */
export const AA_NON_TEXT = 3;

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Expected a 6-digit hex color, got "${hex}"`);
  }
  const r = channel(parseInt(normalized.slice(0, 2), 16));
  const g = channel(parseInt(normalized.slice(2, 4), 16));
  const b = channel(parseInt(normalized.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colors, 1 (identical) to 21 (black/white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(
  foreground: string,
  background: string,
  threshold: number = AA_NORMAL,
): boolean {
  return contrastRatio(foreground, background) >= threshold;
}
