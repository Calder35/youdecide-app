/**
 * Spacing + shape tokens. 4pt base grid; every gap in the app is a multiple.
 */

export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/**
 * Minimum interactive target. 44pt is the Apple HIG floor and above the WCAG
 * 2.2 target-size minimum; nothing tappable in this app goes below it.
 */
export const hitTarget = {
  min: 44,
} as const;

export const layout = {
  screenPaddingHorizontal: space.lg,
  screenPaddingVertical: space.xl,
  contentMaxWidth: 640,
} as const;

export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
