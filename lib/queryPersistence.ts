/**
 * Offline persistence for the query cache (Checkpoint 6).
 *
 * ⚠️ PRIVACY: this introduces an on-disk cache of personal data (photos,
 * leaderboard, event info) where the app previously had NONE. It is governed by:
 *
 *   1. **Allowlist only.** `PERSISTED_QUERY_KEYS` names the exact query roots
 *      that may be written to disk. Everything else — especially anything auth-
 *      or session-derived — is dropped by `dehydrateOptions.shouldDehydrateQuery`.
 *   2. **Scope isolation.** Persisted entries keep their full query key, which
 *      embeds the non-secret `QueryScope` (actor + id + sessionId). A new login
 *      mints a new sessionId, so restored data can never cross accounts.
 *   3. **Purge on teardown.** `purgePersistedCache()` clears BOTH the in-memory
 *      client and the AsyncStorage blob. It is called on logout, account switch,
 *      and GDPR erasure (same paths as the session cache reset).
 *   4. **Version buster.** `buster` is keyed to the app version + a schema tag;
 *      bumping it discards any older on-disk cache.
 *
 * Documented in `docs/ARCHITECTURE.md` §7 and `docs/storage-keys.md`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import type { Query } from '@tanstack/react-query';
import { queryClient } from './queryClient';

/** AsyncStorage key for the persisted cache. Documented in docs/storage-keys.md. */
export const PERSIST_CACHE_KEY = 'eveplan_query_cache_v1';

/**
 * Query-key roots (index 0 of the key tuple) that MAY persist. Deliberately a
 * small allowlist of non-sensitive, session-scoped reads that improve the
 * offline-after-restart experience. NOTE: even these are personal data, so they
 * are scope-isolated and purged on logout/erasure (see file header).
 */
// NOTE: `drinksCatalog`/`drinksStats` are intentionally absent — `drinks.tsx`
// is not yet on TanStack Query (it still uses its own polls), so nothing writes
// those cache roots. Listing them here would imply an offline capability the
// app does not deliver. Re-add if/when the drinks screen is migrated.
const PERSISTED_QUERY_KEYS = new Set<string>([
  'eventInfo',
  'photos',
  'managementEvents',
  'managementSchedule',
]);

/**
 * The real dehydrate predicate — exported so tests exercise the production
 * filter rather than a re-derived copy. Persists only allowlisted roots with a
 * successful result AND a valid (non-anonymous, scope-isolated) query key.
 */
export function shouldPersistQuery(query: Query): boolean {
  const key = query.queryKey;
  const root = key?.[0];
  const actor = key?.[1];
  const id = key?.[2];
  const sessionId = key?.[3];
  return (
    typeof root === 'string' &&
    PERSISTED_QUERY_KEYS.has(root) &&
    query.state.status === 'success' &&
    actor !== 'anon' &&
    typeof id === 'number' &&
    id > 0 &&
    typeof sessionId === 'string' &&
    sessionId.length > 0
  );
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_CACHE_KEY,
});

/** App-version + schema tag; bumping the schema tag discards older on-disk caches. */
function buster(): string {
  const version = Constants.expoConfig?.version ?? '0';
  return `${version}-1`;
}

/** Wire persistence with the allowlist policy. Call once at app bootstrap. */
export function initQueryPersistence(): void {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24h — stale cache beyond this is discarded.
    buster: buster(),
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  });
}

/**
 * Remove ALL persisted personal data from disk and memory. Called on logout,
 * account switch, and GDPR erasure. Never leave guest/organizer data behind.
 */
export async function purgePersistedCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
