import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';
import i18n from './i18n';

export type Language = 'de' | 'en';

const SUPPORTED: Language[] = ['de', 'en'];

function detectDeviceLanguage(): Language | null {
  const code = Localization.getLocales?.()?.[0]?.languageCode ?? '';
  return SUPPORTED.find((l) => code.startsWith(l)) ?? null;
}

type LanguageContextType = {
  language: Language;
  needsLanguagePick: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, options?: object) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('en');
  const [needsLanguagePick, setNeedsLanguagePick] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('app_language').then((saved) => {
      if (saved === 'de' || saved === 'en') {
        // Nutzer hat schon mal manuell gewählt
        i18n.locale = saved;
        setLang(saved);
      } else {
        const deviceLang = detectDeviceLanguage();
        if (deviceLang) {
          // Gerätesprache erkannt → automatisch setzen
          i18n.locale = deviceLang;
          setLang(deviceLang);
        } else {
          // Weder gespeichert noch erkennbar → beim Onboarding abfragen
          setNeedsLanguagePick(true);
        }
      }
    });
  }, []);

  async function setLanguage(lang: Language) {
    i18n.locale = lang;
    setLang(lang);
    setNeedsLanguagePick(false);
    await SecureStore.setItemAsync('app_language', lang);
  }

  function t(key: string, options?: object) {
    return i18n.t(key, options);
  }

  return (
    <LanguageContext.Provider value={{ language, needsLanguagePick, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
