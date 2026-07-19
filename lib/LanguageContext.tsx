/**
 * Language provider — persistence + auto-detection wrapper around `i18n-js`.
 *
 * Hydration order matters: on first render the language is a plain `'en'`
 * placeholder so React can boot; the effect then reads SecureStore
 * (`app_language`) and either flips to the persisted choice or falls back to
 * the device locale. If neither yields a supported language, `needsLanguagePick`
 * turns true so `app/scan.tsx` shows the language picker bottom sheet at first
 * login. The `i18n.locale` mutation happens synchronously with the state
 * update so any subsequent `t()` call resolves against the correct catalogue.
 *
 * The provider must sit BELOW any consumer that renders translated text; see
 * `app/_layout.tsx` for the ordering relative to `EventThemeProvider`.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Localization from 'expo-localization';
import i18n from './i18n';
import { getCached, setCached } from './sessionCache';

/** The two catalogues shipped in `locales/`. Adding one requires new files. */
export type Language = 'de' | 'en';

const SUPPORTED: Language[] = ['de', 'en'];

/**
 * Best-effort mapping from the device locale (`de-DE`, `en-US`, ...) to one
 * of the supported languages. Returns `null` when the device speaks something
 * else (e.g. `fr`) — the caller then falls back to the language picker.
 */
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
    getCached('app_language').then((saved) => {
      if (saved === 'de' || saved === 'en') {
        // The guest has picked before — honour it, no device sniffing.
        i18n.locale = saved;
        setLang(saved);
      } else {
        const deviceLang = detectDeviceLanguage();
        if (deviceLang) {
          // Device speaks a supported language — auto-select silently.
          i18n.locale = deviceLang;
          setLang(deviceLang);
        } else {
          // Neither persisted nor detectable — ask during onboarding.
          setNeedsLanguagePick(true);
        }
      }
    });
  }, []);

  /**
   * Update the runtime locale AND persist it, so subsequent app launches
   * skip the auto-detect branch. Also clears `needsLanguagePick` so the
   * onboarding sheet dismisses.
   */
  async function setLanguage(lang: Language) {
    i18n.locale = lang;
    setLang(lang);
    setNeedsLanguagePick(false);
    await setCached('app_language', lang);
  }

  /** Thin re-export of `i18n.t` — kept on the context so consumers only need one hook. */
  function t(key: string, options?: object) {
    return i18n.t(key, options);
  }

  return (
    <LanguageContext.Provider value={{ language, needsLanguagePick, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Access the current language, the setter and the `t()` translator. Throws
 * outside of `LanguageProvider` so that a missing provider is caught at
 * render time instead of producing silently untranslated strings.
 */
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
