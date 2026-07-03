/**
 * Privacy notice fetcher with 24-hour on-device cache.
 *
 * The privacy notice is served by the Laravel backend so wording changes
 * roll out without an App Store update. The client caches the last
 * successful response in `expo-secure-store` for 24 hours — long enough to
 * survive a spotty reception hall, short enough that an update the couple
 * pushes the day before the wedding lands with the next open.
 *
 * On network / endpoint failure we return a stale cache entry if any exists,
 * otherwise the caller receives the raw axios error and is expected to
 * surface the "open in browser" fallback path.
 */
import api from './api';
import * as SecureStore from 'expo-secure-store';

const CACHE_KEY_PREFIX = 'legal_privacy_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * One numbered chapter of the privacy notice. `body_markdown` is intentionally
 * named after the source format the backend authors write in — the client
 * currently renders it verbatim as plain text; upgrading to a markdown
 * renderer is a future follow-up that will not require a schema change.
 */
export type PrivacySection = {
  id: string;
  heading: string;
  body_markdown: string;
};

/** Full backend response for `GET /api/legal/privacy?locale=<de|en>`. */
export type PrivacyNotice = {
  locale: string;
  updated_at: string;
  sections: PrivacySection[];
};

type CacheEntry = {
  fetched_at: number;
  notice: PrivacyNotice;
};

/**
 * Fetch the privacy notice for a locale, refreshing the cache on success.
 *
 * Fallback order on failure:
 *   1. any cached copy (even if stale — the guest strongly prefers something
 *      readable over a blank screen).
 *   2. re-throw the original error so the caller can show its offline UI.
 *
 * @param locale — active app locale (`de` or `en`).
 * @throws the underlying axios error when no cache is available.
 */
export async function fetchPrivacyNotice(locale: string): Promise<PrivacyNotice> {
  try {
    const res = await api.get<PrivacyNotice>('/api/legal/privacy', {
      params: { locale },
    });
    await SecureStore.setItemAsync(
      CACHE_KEY_PREFIX + locale,
      JSON.stringify({ fetched_at: Date.now(), notice: res.data }),
    );
    return res.data;
  } catch (e) {
    const stale = await readCachedPrivacyNotice(locale, true);
    if (stale) return stale;
    throw e;
  }
}

/**
 * Read the on-device cache without a network round-trip.
 *
 * @param locale — cache is keyed per language so a switch does not hand back
 *                  the wrong-language notice.
 * @param allowStale — when `true`, entries older than `CACHE_TTL_MS` are
 *                  still returned. Used by the network-fallback path to
 *                  avoid a blank screen when the backend is unreachable.
 */
export async function readCachedPrivacyNotice(
  locale: string,
  allowStale: boolean = false,
): Promise<PrivacyNotice | null> {
  const raw = await SecureStore.getItemAsync(CACHE_KEY_PREFIX + locale);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry;
    if (!allowStale && Date.now() - entry.fetched_at > CACHE_TTL_MS) return null;
    return entry.notice;
  } catch {
    // Corrupted cache — treat as absent so the next successful fetch
    // overwrites it cleanly.
    return null;
  }
}
