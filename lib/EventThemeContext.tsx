import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetchEventInfo, EventInfo } from './guest';

const FALLBACK_ACCENT     = '#7c2d3e';
const FALLBACK_BACKGROUND = '#e8e3de';
const FALLBACK_CARD       = '#ffffff';
const FALLBACK_HOME_TEXT  = '#ffffff';

export type EventThemeColors = {
  accent: string;
  onAccent: string;   // automatisch abgeleitet — Text AUF accent-gefüllten Buttons
  background: string;
  card: string;
  homeText: string;
};

type EventThemeContextValue = {
  eventInfo: EventInfo | null;
  colors: EventThemeColors;
  loadTheme: () => Promise<void>;
};

/** WCAG-Luminanz-Check: gibt '#fff' oder '#1a1a1a' zurück je nach Helligkeit von accent */
function deriveOnAccent(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.179 ? '#1a1a1a' : '#ffffff';
}

const EventThemeContext = createContext<EventThemeContextValue>({
  eventInfo: null,
  colors: {
    accent: FALLBACK_ACCENT,
    onAccent: deriveOnAccent(FALLBACK_ACCENT),
    background: FALLBACK_BACKGROUND,
    card: FALLBACK_CARD,
    homeText: FALLBACK_HOME_TEXT,
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

  const accent     = eventInfo?.color_accent     ?? FALLBACK_ACCENT;
  const background = eventInfo?.color_background ?? FALLBACK_BACKGROUND;
  const card       = eventInfo?.color_card       ?? FALLBACK_CARD;

  const colors: EventThemeColors = {
    accent,
    onAccent: deriveOnAccent(accent),
    background,
    card,
    homeText: eventInfo?.color_home_text ?? FALLBACK_HOME_TEXT,
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
