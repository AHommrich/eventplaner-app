import { I18n } from 'i18n-js';
import de from '../locales/de';
import en from '../locales/en';

const i18n = new I18n({ de, en });
i18n.defaultLocale = 'de';
i18n.locale = 'de';
i18n.enableFallback = true;

export default i18n;
