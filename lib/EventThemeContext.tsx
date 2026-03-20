import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetchEventInfo, EventInfo } from './guest';
import { FONT_MAP, FontDefinition, FontKey } from '../constants/fonts';

const FALLBACK_PRIMARY   = '#7c2d3e';
const FALLBACK_SECONDARY = '#e8e3de';
const FALLBACK_TERTIARY  = '#ffffff';

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
  homeText: string | null;
  tabTint: string;
  fontFamily: FontDefinition | undefined;
};

type EventThemeContextValue = {
  eventInfo: EventInfo | null;
  colors: EventThemeColors;
  loadTheme: () => Promise<void>;
};

const EventThemeContext = createContext<EventThemeContextValue>({
  eventInfo: null,
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
    homeText: null,
    tabTint: FALLBACK_PRIMARY,
    fontFamily: undefined,
  },
  loadTheme: async () => {},
});

export function EventThemeProvider({ children }: { children: ReactNode }) {
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);

  async function loadTheme() {
    const token = await SecureStore.getItemAsync('guest_token');
    if (!token) return;
    try {
      const info = await fetchEventInfo();
      setEventInfo(info);
    } catch (e) {
      console.warn('[EventTheme] fetchEventInfo failed:', e);
    }
  }

  useEffect(() => {
    loadTheme();
  }, []);

  const fontKey = (eventInfo?.font_heading ?? null) as FontKey | null;
  const fontFamily: FontDefinition | undefined =
    fontKey && FONT_MAP[fontKey] ? FONT_MAP[fontKey] : undefined;

  const colors: EventThemeColors = {
    primary:        eventInfo?.color_primary        ?? FALLBACK_PRIMARY,
    secondary:      eventInfo?.color_secondary      ?? FALLBACK_SECONDARY,
    tertiary:       eventInfo?.color_tertiary       ?? FALLBACK_TERTIARY,
    screenBg:       eventInfo?.color_screen_bg      ?? FALLBACK_SECONDARY,
    card:           eventInfo?.color_card           ?? FALLBACK_TERTIARY,
    cardText:       eventInfo?.color_card_text      ?? FALLBACK_PRIMARY,
    cardButton:     eventInfo?.color_card_button    ?? FALLBACK_PRIMARY,
    cardButtonText: eventInfo?.color_card_button_text ?? FALLBACK_TERTIARY,
    border:         eventInfo?.color_border         ?? FALLBACK_PRIMARY,
    fab:            eventInfo?.color_fab            ?? FALLBACK_PRIMARY,
    fabIcon:        eventInfo?.color_fab_icon       ?? FALLBACK_TERTIARY,
    homeText:       eventInfo?.color_home_text      ?? null,
    tabTint:        eventInfo?.color_tab_tint       ?? FALLBACK_PRIMARY,
    fontFamily,
  };

  return (
    <EventThemeContext.Provider value={{ eventInfo, colors, loadTheme }}>
      {children}
    </EventThemeContext.Provider>
  );
}

export function useEventTheme() {
  return useContext(EventThemeContext);
}
