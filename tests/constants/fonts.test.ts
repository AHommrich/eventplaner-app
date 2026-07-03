/**
 * Font-key registry integrity.
 *
 * Every value the backend can hand back in `EventInfo.font_heading` must
 * map to a real font family name that `expo-font` has registered. A
 * mismatch would silently fall back to the system font instead of the
 * couple-picked heading style.
 */
import { FONT_MAP, FontKey } from '../../constants/fonts';

const ALL_KEYS: FontKey[] = [
  'playfair',
  'cormorant',
  'cinzel',
  'dancing',
  'great_vibes',
  'raleway',
  'lora',
  'josefin',
];

describe('constants/fonts', () => {
  it('FONT_MAP has an entry for every FontKey', () => {
    for (const key of ALL_KEYS) {
      expect(FONT_MAP[key]).toBeDefined();
    }
  });

  it('every entry exposes non-empty regular and bold family names', () => {
    for (const key of ALL_KEYS) {
      const font = FONT_MAP[key];
      expect(typeof font.regular).toBe('string');
      expect(typeof font.bold).toBe('string');
      expect(font.regular.length).toBeGreaterThan(0);
      expect(font.bold.length).toBeGreaterThan(0);
    }
  });

  it('great_vibes maps bold to the 400-regular family (only weight it ships)', () => {
    // Documented in constants/fonts.ts — Great Vibes has no 700-weight,
    // asking for one would produce a system fallback.
    expect(FONT_MAP.great_vibes.bold).toBe(FONT_MAP.great_vibes.regular);
  });

  it('all other fonts differentiate regular and bold', () => {
    for (const key of ALL_KEYS) {
      if (key === 'great_vibes') continue;
      expect(FONT_MAP[key].regular).not.toBe(FONT_MAP[key].bold);
    }
  });
});
