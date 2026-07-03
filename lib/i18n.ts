/**
 * Application-wide `i18n-js` instance.
 *
 * A single singleton is exported so that `LanguageContext` can flip its
 * `.locale` at runtime and every `t(key)` call across the app picks up the
 * change without any prop drilling. German is the fixed default — the wedding
 * is in Germany and every legal artefact (imprint, privacy) is authored in
 * German first. Fallback is enabled so a missing English key silently falls
 * back to the German string rather than rendering the raw key to the guest.
 */
import { I18n } from 'i18n-js';
import de from '../locales/de';
import en from '../locales/en';

const i18n = new I18n({ de, en });
i18n.defaultLocale = 'de';
i18n.locale = 'de';
i18n.enableFallback = true;

export default i18n;
