/**
 * Font registry for the eight Google Fonts the app bundles LOCALLY.
 *
 * Fonts are shipped via the `@expo-google-fonts/*` packages (see
 * `package.json` dependencies) rather than a runtime CDN. Reason: privacy.
 * A CDN request would expose every guest's IP address to a third party at
 * app start — bundling keeps every runtime network call scoped to our own
 * Laravel backend. The `FONT_MAP` mirrors those packages' constant names
 * exactly; renaming a value here without renaming the corresponding
 * `@expo-google-fonts/*` import in `app/_layout.tsx` produces a silent
 * fallback to the system font.
 */

/**
 * Every Google-Font family the backend is allowed to hand back in
 * `EventInfo.font_heading`. Adding a new option requires wiring the matching
 * `@expo-google-fonts/*` package into `app/_layout.tsx` as well.
 */
export type FontKey =
  'playfair' | 'cormorant' | 'cinzel' | 'dancing' | 'great_vibes' | 'raleway' | 'lora' | 'josefin';

/**
 * A resolved pair of font-family strings that `ThemedText` hands to
 * `<Text style={{ fontFamily }}>`. React Native expects the raw family name
 * that `expo-font.useFonts` registered — the same string the Google-Fonts
 * package exports as its constant.
 */
export type FontDefinition = { regular: string; bold: string };

/**
 * Backend-key → font-family lookup consumed by `EventThemeContext`.
 *
 * `great_vibes` intentionally maps both `regular` and `bold` to the 400-weight
 * name because Great Vibes only ships one weight; asking for the 700-weight
 * family that never registered would produce a system-font fallback and
 * silently break the heading style.
 */
export const FONT_MAP: Record<FontKey, FontDefinition> = {
  playfair: { regular: 'PlayfairDisplay_400Regular', bold: 'PlayfairDisplay_700Bold' },
  cormorant: { regular: 'CormorantGaramond_400Regular', bold: 'CormorantGaramond_700Bold' },
  cinzel: { regular: 'Cinzel_400Regular', bold: 'Cinzel_700Bold' },
  dancing: { regular: 'DancingScript_400Regular', bold: 'DancingScript_700Bold' },
  great_vibes: { regular: 'GreatVibes_400Regular', bold: 'GreatVibes_400Regular' },
  raleway: { regular: 'Raleway_400Regular', bold: 'Raleway_700Bold' },
  lora: { regular: 'Lora_400Regular', bold: 'Lora_700Bold' },
  josefin: { regular: 'JosefinSans_400Regular', bold: 'JosefinSans_700Bold' },
};
