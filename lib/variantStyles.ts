/**
 * Style helpers that turn a `DesignVariant` (the form-language preset) plus the
 * event colours into ready-to-spread React Native styles. Screens consume these
 * instead of hard-coding radius/shadow/surface, so switching presets is a
 * one-line data change — see `constants/theme.ts` for the token table.
 */
import { ViewStyle } from 'react-native';
import { DesignVariant } from '../constants/theme';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0')).join('');
}

/** Blend a colour toward white by `amt` (0..1). Returns input unchanged if not 6-digit hex. */
export function lightenHex(hex: string, amt: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(
    rgb[0] + (255 - rgb[0]) * amt,
    rgb[1] + (255 - rgb[1]) * amt,
    rgb[2] + (255 - rgb[2]) * amt
  );
}

/** Blend a colour toward black by `amt` (0..1). Returns input unchanged if not 6-digit hex. */
export function darkenHex(hex: string, amt: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb[0] * (1 - amt), rgb[1] * (1 - amt), rgb[2] * (1 - amt));
}

/**
 * A subtle glossy two-stop gradient derived from ONE base colour — top a touch
 * lighter, bottom a touch darker. Keeps buttons fully backend-driven: change
 * the single base colour and the whole gradient follows automatically.
 */
export function sheenGradient(hex: string): [string, string] {
  return [lightenHex(hex, 0.16), darkenHex(hex, 0.08)];
}

/** Blend two colours: `amt` 0 = a, 1 = b. Returns `a` unchanged if either isn't 6-digit hex. */
export function mixHex(a: string, b: string, amt: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex(
    ca[0] + (cb[0] - ca[0]) * amt,
    ca[1] + (cb[1] - ca[1]) * amt,
    ca[2] + (cb[2] - ca[2]) * amt
  );
}

/**
 * A soft three-stop screen background derived from the event's own colours:
 * a touch lighter at the top, the base tone in the middle, and a subtle warm
 * wash of the brand colour at the bottom. Fully backend-driven (screen bg +
 * primary) — no hard-coded palette.
 */
export function screenGradient(screenBg: string, primary: string): [string, string, string] {
  // Cleaner/airier than a warm wash (closer to the Image-1 luxury reference):
  // a brighter top and only a whisper of the brand tone at the very bottom.
  return [lightenHex(screenBg, 0.08), screenBg, mixHex(screenBg, primary, 0.04)];
}

/** Two-digit alpha hex (`0..1` → `'00'..'ff'`) to append to a 6-digit colour. */
export function alphaHex(alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Apply a preset's surface alpha to a solid hex colour (glass-lite). */
export function withSurfaceAlpha(hex: string, variant: DesignVariant): string {
  // Only 6-digit hex is expected (backend resolves colours); anything else is
  // returned untouched so we never emit a malformed colour string.
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alphaHex(variant.card.surfaceAlpha) : hex;
}

/**
 * Card / surface style for the active preset: radius, glass-lite fill, optional
 * hairline border and the preset's shadow. `cardColor`/`borderColor` come from
 * the resolved event palette.
 */
export function cardSurfaceStyle(
  variant: DesignVariant,
  cardColor: string,
  borderColor: string
): ViewStyle {
  return {
    backgroundColor: withSurfaceAlpha(cardColor, variant),
    borderRadius: variant.radius.card,
    borderWidth: variant.card.borderWidth,
    borderColor: variant.card.borderWidth ? borderColor + '22' : 'transparent',
    padding: variant.card.padding,
    ...variant.card.shadow,
  };
}
