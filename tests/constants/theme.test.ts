/**
 * Static theme snapshot + structural assertions.
 *
 * The snapshot guards accidental palette drift (a colour hex change becomes a
 * failing test). The structural assertions on top of that catch a shape
 * change (e.g. a key rename) that would silently pass a snapshot review.
 */
import { theme } from '../../constants/theme';

describe('constants/theme', () => {
  it('exposes every documented colour role', () => {
    expect(Object.keys(theme.colors).sort()).toEqual(
      [
        'accent',
        'background',
        'error',
        'muted',
        'primary',
        'sage',
        'secondary',
        'surface',
        'terracotta',
      ].sort()
    );
  });

  it('uses valid hex colour values throughout the palette', () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const value of Object.values(theme.colors)) {
      expect(value).toMatch(hex);
    }
  });

  it('spacing scale is strictly increasing', () => {
    const values = [
      theme.spacing.xs,
      theme.spacing.sm,
      theme.spacing.md,
      theme.spacing.lg,
      theme.spacing.xl,
      theme.spacing.xxl,
    ];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('borderRadius.full is the pill-shape sentinel', () => {
    // 9999 is the standard React-Native trick for pill buttons; anything
    // smaller would produce a rounded rectangle at wide sizes.
    expect(theme.borderRadius.full).toBe(9999);
  });

  it('snapshot of the full palette', () => {
    expect(theme.colors).toMatchSnapshot();
  });
});
