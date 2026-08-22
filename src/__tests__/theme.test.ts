import { hitTarget, space, textStyle, theme } from '../theme';

describe('design tokens', () => {
  it('keeps spacing on the 4pt grid (xxs is the one deliberate half-step)', () => {
    const offGrid = Object.entries(space)
      .filter(([name, value]) => value % 4 !== 0 && name !== 'xxs')
      .map(([name]) => name);
    expect(offGrid).toEqual([]);
  });

  it('never lets an interactive target fall below the 44pt floor', () => {
    expect(hitTarget.min).toBeGreaterThanOrEqual(44);
  });

  it('keeps the smallest text role readable', () => {
    const sizes = Object.values(textStyle).map((style) => style.fontSize);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it('gives every text role a line height with room to breathe', () => {
    const cramped = Object.entries(textStyle)
      .filter(([, style]) => style.lineHeight <= style.fontSize)
      .map(([name]) => name);
    expect(cramped).toEqual([]);
  });

  it('uses valid hex for every semantic color', () => {
    const invalid = Object.entries(theme.color)
      .filter(([, value]) => !/^#[0-9A-Fa-f]{6}$/.test(value))
      .map(([name]) => name);
    expect(invalid).toEqual([]);
  });
});
