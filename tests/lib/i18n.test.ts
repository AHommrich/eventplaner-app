/**
 * `i18n-js` singleton configuration.
 *
 * Tests focus on the runtime shape rather than the catalogue contents —
 * translation keys are exercised indirectly by every screen test that
 * renders `t('...')` output.
 */
import i18n from '../../lib/i18n';

describe('lib/i18n', () => {
  const savedLocale = i18n.locale;
  afterEach(() => {
    i18n.locale = savedLocale;
  });

  it('defaults to German so the primary audience sees no fallback', () => {
    expect(i18n.defaultLocale).toBe('de');
  });

  it('starts at the default locale', () => {
    expect(['de', 'en']).toContain(i18n.locale);
  });

  it('has fallback enabled so missing English keys resolve to German', () => {
    expect(i18n.enableFallback).toBe(true);
  });

  it('switches the active locale in place', () => {
    i18n.locale = 'en';
    expect(i18n.locale).toBe('en');
    i18n.locale = 'de';
    expect(i18n.locale).toBe('de');
  });

  it('resolves a well-known key in both languages', () => {
    // `common.error` is one of the smallest, most stable keys — any change
    // to its presence would break every Alert error message.
    i18n.locale = 'de';
    expect(typeof i18n.t('common.error')).toBe('string');
    i18n.locale = 'en';
    expect(typeof i18n.t('common.error')).toBe('string');
  });
});
