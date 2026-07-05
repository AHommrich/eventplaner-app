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
