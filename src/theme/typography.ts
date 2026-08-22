/**
 * Type tokens.
 *
 * System fonts only for v1 — no custom font loading, so first paint is never
 * blocked and text respects the platform's own rendering. Sizes are unitless
 * points; React Native scales them with the OS text-size setting unless a
 * component opts out (nothing here does).
 */

import type { TextStyle } from 'react-native';

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

const scale = (size: number, ratio: number) => Math.round(size * ratio);

/**
 * Named text roles. Screens use these instead of raw sizes so the reading
 * hierarchy stays consistent — important for a flow that has to explain a fee
 * structure without a disclaimer wall.
 */
export const textStyle = {
  display: {
    fontSize: fontSize.xxxl,
    lineHeight: scale(fontSize.xxxl, lineHeight.tight),
    fontWeight: fontWeight.bold,
  },
  title: {
    fontSize: fontSize.xxl,
    lineHeight: scale(fontSize.xxl, lineHeight.tight),
    fontWeight: fontWeight.bold,
  },
  heading: {
    fontSize: fontSize.xl,
    lineHeight: scale(fontSize.xl, lineHeight.tight),
    fontWeight: fontWeight.semibold,
  },
  subheading: {
    fontSize: fontSize.lg,
    lineHeight: scale(fontSize.lg, lineHeight.normal),
    fontWeight: fontWeight.semibold,
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: scale(fontSize.md, lineHeight.relaxed),
    fontWeight: fontWeight.regular,
  },
  bodyStrong: {
    fontSize: fontSize.md,
    lineHeight: scale(fontSize.md, lineHeight.relaxed),
    fontWeight: fontWeight.semibold,
  },
  caption: {
    fontSize: fontSize.sm,
    lineHeight: scale(fontSize.sm, lineHeight.normal),
    fontWeight: fontWeight.regular,
  },
  // Provenance lines ("Source: Clark County Assessor, 2025") — small, but never
  // below 12pt, because a source the user cannot read is not a source.
  micro: {
    fontSize: fontSize.xs,
    lineHeight: scale(fontSize.xs, lineHeight.normal),
    fontWeight: fontWeight.medium,
  },
} as const satisfies Record<string, TextStyle>;

export type TextStyleToken = keyof typeof textStyle;
