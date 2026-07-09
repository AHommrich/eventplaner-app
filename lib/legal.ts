/**
 * Legal notice fetchers with 24-hour on-device cache.
 *
 * The privacy notice is served by the Laravel backend so wording changes
 * roll out without an App Store update. The client caches the last
 * successful response in `expo-secure-store` for 24 hours — long enough to
 * survive a spotty reception hall, short enough that an update the couple
 * pushes the day before the wedding lands with the next open.
 *
 * On network / endpoint failure we return a stale cache entry if any exists,
 * otherwise a static bundle fallback is shown so first-launch offline never
 * produces a blank legal screen.
 */
import api from './api';
import * as SecureStore from 'expo-secure-store';
import { getFallbackImprint, getFallbackPrivacyNotice } from '../constants/legal-fallback';

const PRIVACY_CACHE_KEY_PREFIX = 'legal_privacy_cache_';
const IMPRINT_CACHE_KEY_PREFIX = 'legal_imprint_cache_';
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
 *   2. static bundle copy.
 *
 * @param locale — active app locale (`de` or `en`).
 */
export async function fetchPrivacyNotice(locale: string): Promise<PrivacyNotice> {
  try {
    const res = await api.get<PrivacyNotice>('/api/legal/privacy', {
      params: { locale },
    });
    await SecureStore.setItemAsync(
      PRIVACY_CACHE_KEY_PREFIX + locale,
      JSON.stringify({ fetched_at: Date.now(), notice: res.data })
    );
    return res.data;
  } catch (e) {
    const stale = await readCachedPrivacyNotice(locale, true);
    if (stale) return stale;
    return getFallbackPrivacyNotice(locale);
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
  allowStale: boolean = false
): Promise<PrivacyNotice | null> {
  return readCachedLegalNotice(PRIVACY_CACHE_KEY_PREFIX, locale, allowStale);
}

/** Full backend response for `GET /api/legal/imprint?locale=<de|en>`. */
export type ImprintNotice = PrivacyNotice;

/**
 * Fetch the imprint for a locale, refreshing the cache on success.
 * Falls back to stale cache on network failure, mirroring privacy behaviour.
 */
export async function fetchImprint(locale: string): Promise<ImprintNotice> {
  try {
    const res = await api.get<ImprintNotice>('/api/legal/imprint', {
      params: { locale },
    });
    await SecureStore.setItemAsync(
      IMPRINT_CACHE_KEY_PREFIX + locale,
      JSON.stringify({ fetched_at: Date.now(), notice: res.data })
    );
    return res.data;
  } catch (e) {
    const stale = await readCachedImprint(locale, true);
    if (stale) return stale;
    return getFallbackImprint(locale);
  }
}

/** Read the cached imprint without a network round-trip. */
export async function readCachedImprint(
  locale: string,
  allowStale: boolean = false
): Promise<ImprintNotice | null> {
  return readCachedLegalNotice(IMPRINT_CACHE_KEY_PREFIX, locale, allowStale);
}

async function readCachedLegalNotice(
  prefix: string,
  locale: string,
  allowStale: boolean
): Promise<PrivacyNotice | null> {
  const raw = await SecureStore.getItemAsync(prefix + locale);
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
