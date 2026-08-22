/**
 * The design tokens, in one import.
 *
 *   import { theme } from '../theme';
 *
 * Screens and components must not hard-code colors, sizes, or spacing. If a
 * value is missing, add a token here rather than a literal at the call site.
 */

import { color } from './colors';
import { hitTarget, layout, radius, space } from './spacing';
import { fontSize, fontWeight, lineHeight, textStyle } from './typography';

export const theme = {
  color,
  space,
  radius,
  hitTarget,
  layout,
  fontSize,
  fontWeight,
  lineHeight,
  textStyle,
} as const;

export type Theme = typeof theme;

export { color } from './colors';
export { hitTarget, layout, radius, space } from './spacing';
export { fontSize, fontWeight, lineHeight, textStyle } from './typography';
export type { ColorToken } from './colors';
export type { RadiusToken, SpaceToken } from './spacing';
export type { TextStyleToken } from './typography';
