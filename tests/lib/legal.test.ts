/**
 * `lib/legal` — privacy-notice fetch + cache.
 *
 * The suite exercises the four states the network fallback traverses:
 * fresh → cache-hit-fresh → cache-hit-stale → cache-miss.
 */
import * as SecureStore from 'expo-secure-store';
import {
  fetchImprint,
  fetchPrivacyNotice,
  readCachedImprint,
  readCachedPrivacyNotice,
  PrivacyNotice,
} from '../../lib/legal';
import { getFallbackImprint, getFallbackPrivacyNotice } from '../../constants/legal-fallback';

jest.mock('../../lib/api', () => {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return { __esModule: true, default: mock };
});

const api = require('../../lib/api').default;

const notice: PrivacyNotice = {
  locale: 'de',
  updated_at: '2026-07-01T00:00:00Z',
  sections: [
    { id: 'a', heading: 'Verantwortlicher', body_markdown: 'André & Tabea' },
    { id: 'b', heading: 'Datenverarbeitung', body_markdown: 'Nur RSVP + Fotos' },
  ],
};

describe('lib/legal', () => {
  beforeEach(async () => {
    api.get.mockReset();
    await SecureStore.deleteItemAsync('legal_privacy_cache_de');
    await SecureStore.deleteItemAsync('legal_privacy_cache_en');
    await SecureStore.deleteItemAsync('legal_imprint_cache_de');
    await SecureStore.deleteItemAsync('legal_imprint_cache_en');
  });

  it('fetches from the backend and caches the response', async () => {
    api.get.mockResolvedValueOnce({ data: notice });
    const result = await fetchPrivacyNotice('de');
    expect(api.get).toHaveBeenCalledWith('/api/legal/privacy', { params: { locale: 'de' } });
    expect(result).toEqual(notice);

    const cached = await SecureStore.getItemAsync('legal_privacy_cache_de');
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.notice).toEqual(notice);
    expect(typeof parsed.fetched_at).toBe('number');
  });

  it('falls back to a cached copy when the network call fails', async () => {
    // Prime the cache.
    api.get.mockResolvedValueOnce({ data: notice });
    await fetchPrivacyNotice('de');
    api.get.mockReset();

    // Second call fails — should return cached notice.
    api.get.mockRejectedValueOnce(new Error('offline'));
    const result = await fetchPrivacyNotice('de');
    expect(result).toEqual(notice);
  });

  it('falls back even to a stale cache entry on network failure', async () => {
    // Manually plant a stale entry (age > 24 h).
    const stale = {
      fetched_at: Date.now() - 48 * 60 * 60 * 1000,
      notice,
    };
    await SecureStore.setItemAsync('legal_privacy_cache_de', JSON.stringify(stale));
    api.get.mockRejectedValueOnce(new Error('offline'));

    const result = await fetchPrivacyNotice('de');
    expect(result).toEqual(notice);
  });

  it('falls back to the bundled privacy notice when no network AND no cache', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const result = await fetchPrivacyNotice('de');

    expect(result.locale).toBe('de');
    expect(result.sections.map((section) => section.id)).toContain('controller');
    expect(result.sections.map((section) => section.id)).toContain('rights');
  });

  it('caches per-locale so a language switch does not serve the wrong notice', async () => {
    api.get.mockResolvedValueOnce({ data: notice });
    await fetchPrivacyNotice('de');

    // No en cache exists yet — a stale check returns null.
    const enCache = await readCachedPrivacyNotice('en');
    expect(enCache).toBeNull();
  });
});

describe('lib/legal — imprint', () => {
  beforeEach(async () => {
    api.get.mockReset();
    await SecureStore.deleteItemAsync('legal_imprint_cache_de');
    await SecureStore.deleteItemAsync('legal_imprint_cache_en');
  });

  it('fetches the imprint from the backend and caches it', async () => {
    api.get.mockResolvedValueOnce({ data: notice });
    const result = await fetchImprint('de');
    expect(api.get).toHaveBeenCalledWith('/api/legal/imprint', { params: { locale: 'de' } });
    expect(result).toEqual(notice);

    const cached = await SecureStore.getItemAsync('legal_imprint_cache_de');
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!).notice).toEqual(notice);
  });

  it('falls back to a stale imprint cache when the network call fails', async () => {
    await SecureStore.setItemAsync(
      'legal_imprint_cache_de',
      JSON.stringify({ fetched_at: Date.now() - 48 * 60 * 60 * 1000, notice })
    );
    api.get.mockRejectedValueOnce(new Error('offline'));

    const result = await fetchImprint('de');
    expect(result).toEqual(notice);
  });

  it('readCachedImprint returns null when no cache exists', async () => {
    await expect(readCachedImprint('de')).resolves.toBeNull();
  });

  it('falls back to the bundled imprint when the network call fails and no cache exists', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const result = await fetchImprint('de');

    expect(result.locale).toBe('de');
    expect(result.sections.map((section) => section.id)).toContain('provider');
    expect(result.sections.map((section) => section.id)).toContain('contact');
  });
});

describe('lib/legal — readCachedPrivacyNotice', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('legal_privacy_cache_de');
  });

  it('returns null when no cache exists', async () => {
    const result = await readCachedPrivacyNotice('de');
    expect(result).toBeNull();
  });

  it('returns the cached notice when it is fresh', async () => {
    await SecureStore.setItemAsync(
      'legal_privacy_cache_de',
      JSON.stringify({ fetched_at: Date.now(), notice })
    );
    const result = await readCachedPrivacyNotice('de');
    expect(result).toEqual(notice);
  });

  it('returns null when the cache is stale and allowStale is false', async () => {
    await SecureStore.setItemAsync(
      'legal_privacy_cache_de',
      JSON.stringify({ fetched_at: Date.now() - 48 * 60 * 60 * 1000, notice })
    );
    const result = await readCachedPrivacyNotice('de');
    expect(result).toBeNull();
  });

  it('returns a stale entry when explicitly allowed', async () => {
    await SecureStore.setItemAsync(
      'legal_privacy_cache_de',
      JSON.stringify({ fetched_at: Date.now() - 48 * 60 * 60 * 1000, notice })
    );
    const result = await readCachedPrivacyNotice('de', true);
    expect(result).toEqual(notice);
  });

  it('returns null when the cache is corrupted JSON', async () => {
    await SecureStore.setItemAsync('legal_privacy_cache_de', '{not valid json');
    const result = await readCachedPrivacyNotice('de');
    expect(result).toBeNull();
  });
});

describe('constants/legal-fallback', () => {
  it('ships German and English privacy fallbacks', () => {
    expect(getFallbackPrivacyNotice('de').locale).toBe('de');
    expect(getFallbackPrivacyNotice('en').locale).toBe('en');
  });

  it('ships German and English imprint fallbacks', () => {
    expect(getFallbackImprint('de').locale).toBe('de');
    expect(getFallbackImprint('en').locale).toBe('en');
  });

  it('falls back to English for unsupported locales', () => {
    expect(getFallbackPrivacyNotice('fr').locale).toBe('en');
    expect(getFallbackImprint('fr').locale).toBe('en');
  });
});
