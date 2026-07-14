/**
 * Static design tokens — the single source of truth for anything that does
 * NOT flow from the backend.
 *
 * Two rules of thumb documented in `CLAUDE.md`:
 *   - Brand + layout colours come from `useEventTheme()` (dynamic, per event).
 *   - Semantic colours (`error`, `sage`, `muted`) come from here so a wedding
 *     that ships without a full palette still has meaningful success/error
 *     signals. Never hardcode hex values inside a screen.
 *
 * Values here mirror `tailwind.config.js`; when either side changes the other
 * must be updated in lock-step.
 */
export const theme = {
  colors: {
    // --- Brand fallbacks (only used if the backend palette is incomplete) ---
    primary: '#7B1E1E', // Deep burgundy — default heading/text tone
    secondary: '#FFFFFF', // White — text on dark backgrounds
    accent: '#C47B20', // Warm amber — buttons, FAB, highlights
    terracotta: '#C4421A', // Terracotta — secondary buttons, borders, dividers
    // --- Semantic states (never overridden by the backend) ---
    sage: '#5A7A4A', // Sage green — success states, RSVP accepted
    background: '#EAE5DC', // Linen white — global screen background fallback
    surface: '#F5F2EC', // Warm white — card surfaces, tab bar
    muted: '#7A6A5A', // Warm grey — secondary text, disabled labels
    error: '#BF4020', // Terracotta red — error alerts, decline actions
  },
  fontFamily: {
    /** Neutral placeholder used before the event font has resolved. */
    sans: 'System',
  },
  /** Spacing scale in device-independent pixels — matches Tailwind's `spacing-*`. */
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  /** Radius scale — `full` is the standard React-Native trick for pill buttons. */
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
} as const;

/**
 * Design presets — the backend-selectable "form language" layer.
 *
 * A preset changes ONLY the shape of the UI (corner radius, card surface,
 * shadow, density, button shape, tab-bar treatment) — never the palette, font,
 * layout or content. It is a second, orthogonal axis on top of the colour
 * system: the couple keeps picking colours as before, and independently picks
 * a preset.
 *
 * The numeric values here are authoritative. The web editor's phone preview
 * mirrors this table (same discipline as `theme.ts` mirroring
 * `tailwind.config.js`) — keep both sides in lock-step.
 *
 * `surfaceAlpha < 1` is "glass-lite": a slightly translucent card that reads as
 * frosted over a photo (Home cover) and as a soft warm-white elsewhere, with
 * ZERO runtime cost. True `expo-blur` frosting is a later opt-in gated on
 * `blur > 0`; the default keeps `blur: 0` so there is no performance risk.
 */
export type DesignVariantKey = 'classic' | 'soft-luxury';

/** RN shadow preset, ready to spread into a style object. */
export type ShadowPreset = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export type DesignVariant = {
  key: DesignVariantKey;
  /** Corner radii per surface type. */
  radius: { card: number; tile: number; button: number };
  /** Card / surface treatment. */
  card: {
    surfaceAlpha: number;
    borderWidth: number;
    padding: number;
    shadow: ShadowPreset;
  };
  /** Vertical gap between stacked cards. */
  gap: number;
  /** Tab bar treatment: docked (classic) vs a rounded, elevated "sheet". */
  tabBar: 'docked' | 'sheet';
  /** Radius applied to the floating tab-bar sheet (0 when docked). */
  tabBarRadius: number;
  /** 0 = glass-lite (no expo-blur); > 0 = true frosted blur (later opt-in). */
  blur: number;
};

const SHADOW_FLAT: ShadowPreset = {
  shadowColor: '#5a3238',
  shadowOpacity: 0.06,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

const SHADOW_SOFT: ShadowPreset = {
  shadowColor: '#5a3238',
  shadowOpacity: 0.16,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
};

export const DESIGN_VARIANTS: Record<DesignVariantKey, DesignVariant> = {
  classic: {
    key: 'classic',
    radius: { card: 18, tile: 8, button: 12 },
    card: { surfaceAlpha: 1, borderWidth: 1, padding: 16, shadow: SHADOW_FLAT },
    gap: 16,
    tabBar: 'docked',
    tabBarRadius: 0,
    blur: 0,
  },
  'soft-luxury': {
    key: 'soft-luxury',
    radius: { card: 26, tile: 16, button: 9999 },
    card: { surfaceAlpha: 0.82, borderWidth: 0, padding: 20, shadow: SHADOW_SOFT },
    gap: 18,
    tabBar: 'sheet',
    tabBarRadius: 24,
    blur: 0,
  },
};

/** The preset used until the backend says otherwise (or for legacy events). */
export const DEFAULT_DESIGN_VARIANT: DesignVariantKey = 'classic';

/**
 * DEV-only override to preview a preset before the backend field exists. Set to
 * a variant key to force it across the whole app; leave `null` for normal
 * backend-driven behaviour. MUST be `null` before shipping.
 */
export const DEV_FORCE_DESIGN_VARIANT: DesignVariantKey | null = null;
