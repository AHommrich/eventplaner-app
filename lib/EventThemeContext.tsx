/**
 * Dynamic theme provider — colours + font come from the backend.
 *
 * The backend hands back three raw palette colours (`primary`, `secondary`,
 * `tertiary`) PLUS a set of already-resolved role colours (`color_card`,
 * `color_card_text`, etc.). The role colours exist so the couple can pick
 * exceptions like "card buttons should be terracotta even though the primary
 * is burgundy" without the client re-deriving them from the palette. Screens
 * consume the roles directly — `useEventTheme().colors.cardButton` — and
 * fall back to the raw palette or a hard-coded default when a role isn't set.
 *
 * The provider fetches on mount (if a session is present) AND exposes
 * `loadTheme()` so pull-to-refresh in each tab can pick up mid-event colour
 * changes without a full reload. Fonts follow the same rule: the backend
 * hands a `font_heading` key, this provider looks it up in the local
 * `FONT_MAP` and exposes it as `colors.fontFamily` for `ThemedText` and the
 * tab-bar label style.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetchEventInfo, EventInfo } from './guest';
import { FONT_MAP, FontDefinition, FontKey } from '../constants/fonts';
import {
  DESIGN_VARIANTS,
  DesignVariant,
  DEFAULT_DESIGN_VARIANT,
  DEV_FORCE_DESIGN_VARIANT,
} from '../constants/theme';

/**
 * Resolve the active design preset: DEV override → backend `design_preset` →
 * default. Never throws on an unknown key (legacy/typo) — falls back cleanly.
 */
function resolveVariant(eventInfo: EventInfo | null): DesignVariant {
  const key = DEV_FORCE_DESIGN_VARIANT ?? eventInfo?.design_preset ?? DEFAULT_DESIGN_VARIANT;
  return DESIGN_VARIANTS[key] ?? DESIGN_VARIANTS[DEFAULT_DESIGN_VARIANT];
}

// --- Fallback palette (used until the first backend fetch resolves) ---
const FALLBACK_PRIMARY = '#7c2d3e';
const FALLBACK_SECONDARY = '#e8e3de';
const FALLBACK_TERTIARY = '#ffffff';

/**
 * Resolved colour set consumed by every screen. Screens should reach for the
 * semantic role fields (`cardButton`, `homeText`, ...) before the raw palette
 * so the couple's overrides win.
 */
export type EventThemeColors = {
  primary: string;
  secondary: string;
  tertiary: string;
  screenBg: string;
  card: string;
  cardText: string;
  cardButton: string;
  cardButtonText: string;
  border: string;
  fab: string;
  fabIcon: string;
  /** Bottom tab bar background (classic = solid, soft-luxury = frosted). */
  navBg: string;
  /** `null` when the home cover has no legible text overlay for this palette. */
  homeText: string | null;
  homeShadow: string;
  tabTint: string;
  /** `undefined` when the backend hasn't picked a font, then system font wins. */
  fontFamily: FontDefinition | undefined;
};

type EventThemeContextValue = {
  eventInfo: EventInfo | null;
  colors: EventThemeColors;
  /** Active design preset — the form-language layer (see DESIGN_VARIANTS). */
  variant: DesignVariant;
  loadTheme: () => Promise<void>;
};

const EventThemeContext = createContext<EventThemeContextValue>({
  eventInfo: null,
  variant: DESIGN_VARIANTS[DEFAULT_DESIGN_VARIANT],
  colors: {
    primary: FALLBACK_PRIMARY,
    secondary: FALLBACK_SECONDARY,
    tertiary: FALLBACK_TERTIARY,
    screenBg: FALLBACK_SECONDARY,
    card: FALLBACK_TERTIARY,
    cardText: FALLBACK_PRIMARY,
    cardButton: FALLBACK_PRIMARY,
    cardButtonText: FALLBACK_TERTIARY,
    border: FALLBACK_PRIMARY,
    fab: FALLBACK_PRIMARY,
    fabIcon: FALLBACK_TERTIARY,
    navBg: FALLBACK_SECONDARY,
    homeText: null,
    homeShadow: '#000000',
    tabTint: FALLBACK_PRIMARY,
    fontFamily: undefined,
  },
  loadTheme: async () => {},
});

/**
 * Root-level theme provider. Fetches `EventInfo` when a session exists so a
 * logged-out cold start does not fire an unauthorised request. Consumers
 * re-trigger the fetch via `loadTheme()` on pull-to-refresh in each tab.
 */
export function EventThemeProvider({ children }: { children: ReactNode }) {
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);

  async function loadTheme() {
    const token = await SecureStore.getItemAsync('guest_token');
    if (!token) return;
    try {
      const info = await fetchEventInfo();
      setEventInfo(info);
    } catch (e) {
      // Non-fatal: keep the fallback palette so the app is still usable.
      console.warn('[EventTheme] fetchEventInfo failed:', e);
    }
  }

  useEffect(() => {
    // Bootstrap theme fetch → `setEventInfo`. The state update runs in the
    // resolved-promise microtask, not synchronously in the effect body, so
    // React 19's `set-state-in-effect` diagnostic is a false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTheme();
  }, []);

  // --- Font resolution ---
  const fontKey = (eventInfo?.font_heading ?? null) as FontKey | null;
  const fontFamily: FontDefinition | undefined =
    fontKey && FONT_MAP[fontKey] ? FONT_MAP[fontKey] : undefined;

  // --- Colour resolution: backend role → backend palette → hard-coded fallback ---
  const colors: EventThemeColors = {
    primary: eventInfo?.color_primary ?? FALLBACK_PRIMARY,
    secondary: eventInfo?.color_secondary ?? FALLBACK_SECONDARY,
    tertiary: eventInfo?.color_tertiary ?? FALLBACK_TERTIARY,
    screenBg: eventInfo?.color_screen_bg ?? FALLBACK_SECONDARY,
    card: eventInfo?.color_card ?? FALLBACK_TERTIARY,
    cardText: eventInfo?.color_card_text ?? FALLBACK_PRIMARY,
    cardButton: eventInfo?.color_card_button ?? FALLBACK_PRIMARY,
    cardButtonText: eventInfo?.color_card_button_text ?? FALLBACK_TERTIARY,
    border: eventInfo?.color_border ?? FALLBACK_PRIMARY,
    fab: eventInfo?.color_fab ?? FALLBACK_PRIMARY,
    fabIcon: eventInfo?.color_fab_icon ?? FALLBACK_TERTIARY,
    navBg: eventInfo?.color_nav_bg ?? FALLBACK_SECONDARY,
    homeText: eventInfo?.color_home_text ?? null,
    homeShadow: eventInfo?.color_home_shadow ?? '#000000',
    tabTint: eventInfo?.color_tab_tint ?? FALLBACK_PRIMARY,
    fontFamily,
  };

  const variant = resolveVariant(eventInfo);

  return (
    <EventThemeContext.Provider value={{ eventInfo, colors, variant, loadTheme }}>
      {children}
    </EventThemeContext.Provider>
  );
}

/**
 * Read the current theme + `EventInfo` + a `loadTheme` refresher. Never
 * throws — pre-fetch consumers see the fallback palette instead of a crash.
 */
export function useEventTheme() {
  return useContext(EventThemeContext);
}
