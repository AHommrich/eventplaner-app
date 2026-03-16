import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetchEventInfo, EventInfo } from './guest';

const FALLBACK_PRIMARY = '#7c2d3e';
const FALLBACK_BACKGROUND = '#e8e3de';
const FALLBACK_HOME_TEXT = '#ffffff';

export type EventThemeColors = {
  primary: string;
  background: string;
  homeText: string;
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
    background: FALLBACK_BACKGROUND,
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

  const colors: EventThemeColors = {
    primary: eventInfo?.color_primary ?? FALLBACK_PRIMARY,
    background: eventInfo?.color_secondary ?? FALLBACK_BACKGROUND,
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
