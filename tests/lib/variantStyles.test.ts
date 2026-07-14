/**
 * Colour + surface helpers for the design presets. These are pure functions, so
 * the tests pin the exact maths (a drift in the derived gradient/tint becomes a
 * failing test) and cover the "not a 6-digit hex → returned untouched" guards.
 */
import {
  lightenHex,
  darkenHex,
  mixHex,
  sheenGradient,
  screenGradient,
  alphaHex,
  withSurfaceAlpha,
  cardSurfaceStyle,
} from '../../lib/variantStyles';
import { DESIGN_VARIANTS } from '../../constants/theme';

describe('lib/variantStyles', () => {
  describe('lightenHex', () => {
    it('blends toward white by the given amount', () => {
      expect(lightenHex('#000000', 0.5)).toBe('#808080');
      expect(lightenHex('#000000', 1)).toBe('#ffffff');
      expect(lightenHex('#ffffff', 0.5)).toBe('#ffffff');
    });
    it('accepts hex without the leading hash', () => {
      expect(lightenHex('000000', 1)).toBe('#ffffff');
    });
    it('returns the input unchanged when not a 6-digit hex', () => {
      expect(lightenHex('rgb(0,0,0)', 0.5)).toBe('rgb(0,0,0)');
      expect(lightenHex('#abc', 0.5)).toBe('#abc');
    });
  });

  describe('darkenHex', () => {
    it('blends toward black by the given amount', () => {
      expect(darkenHex('#ffffff', 0.5)).toBe('#808080');
      expect(darkenHex('#ffffff', 1)).toBe('#000000');
      expect(darkenHex('#000000', 0.5)).toBe('#000000');
    });
    it('returns the input unchanged when not a 6-digit hex', () => {
      expect(darkenHex('nope', 0.5)).toBe('nope');
    });
  });

  describe('mixHex', () => {
    it('interpolates between two colours', () => {
      expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
      expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
      expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    });
    it('returns the first colour unchanged when either side is invalid', () => {
      expect(mixHex('#123456', 'bad', 0.5)).toBe('#123456');
      expect(mixHex('bad', '#123456', 0.5)).toBe('bad');
    });
  });

  describe('sheenGradient', () => {
    it('returns a lighter-top, darker-bottom pair derived from one colour', () => {
      const [top, bottom] = sheenGradient('#808080');
      expect(top).toBe(lightenHex('#808080', 0.16));
      expect(bottom).toBe(darkenHex('#808080', 0.08));
    });
  });

  describe('screenGradient', () => {
    it('returns a three-stop background derived from screen bg + primary', () => {
      const stops = screenGradient('#808080', '#7c2d3e');
      expect(stops).toHaveLength(3);
      expect(stops[0]).toBe(lightenHex('#808080', 0.08));
      expect(stops[1]).toBe('#808080');
      expect(stops[2]).toBe(mixHex('#808080', '#7c2d3e', 0.04));
    });
  });

  describe('alphaHex', () => {
    it('maps 0..1 to a two-digit hex byte', () => {
      expect(alphaHex(0)).toBe('00');
      expect(alphaHex(1)).toBe('ff');
      expect(alphaHex(0.5)).toBe('80');
    });
    it('clamps out-of-range values', () => {
      expect(alphaHex(-1)).toBe('00');
      expect(alphaHex(2)).toBe('ff');
    });
  });

  describe('withSurfaceAlpha', () => {
    it('appends the variant surface alpha to a 6-digit hex', () => {
      const soft = DESIGN_VARIANTS['soft-luxury'];
      expect(withSurfaceAlpha('#ffffff', soft)).toBe('#ffffff' + alphaHex(soft.card.surfaceAlpha));
    });
    it('returns a fully opaque colour untouched (classic alpha = 1)', () => {
      const classic = DESIGN_VARIANTS.classic;
      expect(withSurfaceAlpha('#ffffff', classic)).toBe('#ffffff' + alphaHex(1));
    });
    it('returns the input unchanged when not a 6-digit hex', () => {
      expect(withSurfaceAlpha('transparent', DESIGN_VARIANTS['soft-luxury'])).toBe('transparent');
    });
  });

  describe('cardSurfaceStyle', () => {
    it('uses the preset radius, padding, shadow and a translucent fill (soft-luxury)', () => {
      const soft = DESIGN_VARIANTS['soft-luxury'];
      const style = cardSurfaceStyle(soft, '#ffffff', '#7c2d3e');
      expect(style.borderRadius).toBe(soft.radius.card);
      expect(style.padding).toBe(soft.card.padding);
      expect(style.backgroundColor).toBe(withSurfaceAlpha('#ffffff', soft));
      // borderWidth 0 → transparent border
      expect(style.borderColor).toBe('transparent');
    });
    it('keeps a hairline border colour when the preset has a border (classic)', () => {
      const classic = DESIGN_VARIANTS.classic;
      const style = cardSurfaceStyle(classic, '#ffffff', '#7c2d3e');
      expect(style.borderWidth).toBe(classic.card.borderWidth);
      expect(style.borderColor).toBe('#7c2d3e22');
    });
  });
});
