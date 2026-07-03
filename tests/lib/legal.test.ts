/**
 * `lib/legal` — privacy-notice fetch + cache.
 *
 * The suite exercises the four states the network fallback traverses:
 * fresh → cache-hit-fresh → cache-hit-stale → cache-miss.
 */
import * as SecureStore from 'expo-secure-store';
import { fetchPrivacyNotice, readCachedPrivacyNotice, PrivacyNotice } from '../../lib/legal';

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

  it('re-throws when no network AND no cache', async () => {
    const err = new Error('offline');
    api.get.mockRejectedValueOnce(err);
    await expect(fetchPrivacyNotice('de')).rejects.toBe(err);
  });

  it('caches per-locale so a language switch does not serve the wrong notice', async () => {
    api.get.mockResolvedValueOnce({ data: notice });
    await fetchPrivacyNotice('de');

    // No en cache exists yet — a stale check returns null.
    const enCache = await readCachedPrivacyNotice('en');
    expect(enCache).toBeNull();
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
      JSON.stringify({ fetched_at: Date.now(), notice }),
    );
    const result = await readCachedPrivacyNotice('de');
    expect(result).toEqual(notice);
  });

  it('returns null when the cache is stale and allowStale is false', async () => {
    await SecureStore.setItemAsync(
      'legal_privacy_cache_de',
      JSON.stringify({ fetched_at: Date.now() - 48 * 60 * 60 * 1000, notice }),
    );
    const result = await readCachedPrivacyNotice('de');
    expect(result).toBeNull();
  });

  it('returns a stale entry when explicitly allowed', async () => {
    await SecureStore.setItemAsync(
      'legal_privacy_cache_de',
      JSON.stringify({ fetched_at: Date.now() - 48 * 60 * 60 * 1000, notice }),
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
