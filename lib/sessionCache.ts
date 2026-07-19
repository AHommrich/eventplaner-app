/**
 * In-memory write-through cache for session/auth values (Checkpoint 1).
 *
 * Every `SecureStore.getItemAsync` is a native keychain round-trip. Reading
 * tokens on every request (as the axios interceptor used to) is the wrong
 * pattern. This module is the single source the interceptor and the session
 * context read from:
 *
 *   - **Write-through:** `setCached`/`removeCached` update memory AND SecureStore.
 *   - **Read-through with dedup:** `getCached` returns the memory value, caching
 *     `null` too, and de-duping concurrent in-flight reads — at most one keychain
 *     read per key per generation.
 *   - **Generation counter (in-memory race guard):** bumped on logout / account
 *     switch. A read that started before the bump is discarded on resolve, so a
 *     stale token can never repopulate the cache after logout. This is NOT the
 *     persisted `sessionId`.
 *   - **`sessionId` (persisted, non-secret):** minted at login, stored in
 *     SecureStore, cleared at logout. Stable across app restarts so it can key
 *     the persisted query cache (Checkpoint 6) and the `QueryScope`.
 *   - **Reactive:** `subscribe`/`getScope` back `useSessionScope` (see
 *     `SessionContext.tsx`); every login/logout/switch publishes a new snapshot.
 *
 * SecureStore stays the source of truth (survives restarts, encrypted at rest);
 * this cache is only a hot-path accelerator + reactivity layer over it.
 */
import * as SecureStore from 'expo-secure-store';

export type CacheKey =
  | 'guest_token'
  | 'guest_id'
  | 'management_token'
  | 'management_user_id'
  | 'management_active_event_id'
  | 'app_language'
  | 'session_id';

const KEYS: CacheKey[] = [
  'guest_token',
  'guest_id',
  'management_token',
  'management_user_id',
  'management_active_event_id',
  'app_language',
  'session_id',
];

/**
 * Non-secret query scope. `sessionId` isolates cached data per login so a
 * failed purge cannot leak one account's data to the next. Never key on a
 * bearer token or any secret.
 */
export type QueryScope =
  | { actor: 'guest'; guestId: number; sessionId: string }
  | { actor: 'management'; userId: number; eventId: number; sessionId: string };

// `undefined` = not yet loaded from SecureStore; `null` = loaded, absent.
const memory = new Map<CacheKey, string | null>();
const inflight = new Map<CacheKey, Promise<string | null>>();
let generation = 0;
const listeners = new Set<() => void>();
let currentScope: QueryScope | null = null;
// Dedupes concurrent `primeFromStore()` calls into one keychain sweep.
let primePromise: Promise<void> | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

/** Derive the scope from memory; keep a stable reference until it changes. */
function rebuildScope(): void {
  const next = deriveScope();
  if (!scopeEquals(currentScope, next)) {
    currentScope = next;
    notify();
  }
}

function deriveScope(): QueryScope | null {
  const sessionId = memory.get('session_id') ?? null;
  if (!sessionId) return null;

  const managementToken = memory.get('management_token') ?? null;
  if (managementToken) {
    const userId = Number(memory.get('management_user_id') ?? '');
    const eventId = Number(memory.get('management_active_event_id') ?? '');
    if (!Number.isInteger(userId) || !Number.isInteger(eventId)) return null;
    return { actor: 'management', userId, eventId, sessionId };
  }

  const guestToken = memory.get('guest_token') ?? null;
  if (guestToken) {
    const guestId = Number(memory.get('guest_id') ?? '');
    if (!Number.isInteger(guestId)) return null;
    return { actor: 'guest', guestId, sessionId };
  }

  return null;
}

function scopeEquals(a: QueryScope | null, b: QueryScope | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.actor !== b.actor || a.sessionId !== b.sessionId) return false;
  if (a.actor === 'guest' && b.actor === 'guest') return a.guestId === b.guestId;
  if (a.actor === 'management' && b.actor === 'management') {
    return a.userId === b.userId && a.eventId === b.eventId;
  }
  return false;
}

/**
 * Load every key into memory once; awaited during bootstrap before first paint.
 *
 * Deduped + race-guarded: concurrent callers share a single keychain sweep, and
 * a login/logout that lands mid-sweep wins over the values we read. See
 * `runPrime` for the two guards (generation check + back-fill-only writes).
 */
export function primeFromStore(): Promise<void> {
  if (primePromise) return primePromise;
  primePromise = runPrime().finally(() => {
    primePromise = null;
  });
  return primePromise;
}

async function runPrime(): Promise<void> {
  const startGeneration = generation;
  const values = await Promise.all(KEYS.map((key) => SecureStore.getItemAsync(key)));

  // A logout/switch bumped the generation while we read the keychain — its
  // in-memory writes are now authoritative, so drop this stale snapshot rather
  // than resurrect a signed-out session.
  if (startGeneration !== generation) return;

  KEYS.forEach((key, index) => {
    // Back-fill only keys a concurrent login/logout hasn't already written, so a
    // session that landed mid-sweep is never clobbered by a stale keychain read.
    if (!memory.has(key)) memory.set(key, values[index]);
  });

  // Migration: sessions created before CP1 have a token but no persisted
  // `session_id`. Without it `deriveScope()` returns null and every
  // scope-gated query/screen (guest tabs, organizer photos/notes) breaks after
  // the update. Back-fill one so the existing session keeps working.
  const hasToken = Boolean(memory.get('guest_token') || memory.get('management_token'));
  if (hasToken && !memory.get('session_id')) {
    await mintSessionId(); // writes SecureStore + memory, then rebuilds scope
  }

  rebuildScope();
}

/** Read a value: memory hit, else a single deduped keychain read per generation. */
export async function getCached(key: CacheKey): Promise<string | null> {
  if (memory.has(key)) return memory.get(key)!;

  const existing = inflight.get(key);
  if (existing) return existing;

  const startGeneration = generation;
  const read = SecureStore.getItemAsync(key).then((value) => {
    inflight.delete(key);
    // Discard the result if a logout/switch bumped the generation while the
    // read was in flight — otherwise a stale token would come back to life.
    if (startGeneration === generation && !memory.has(key)) {
      memory.set(key, value);
      return value;
    }
    return memory.get(key) ?? null;
  });
  inflight.set(key, read);
  return read;
}

/** Write-through: update SecureStore and memory, then re-derive the scope. */
export async function setCached(key: CacheKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
  memory.set(key, value);
  rebuildScope();
}

/**
 * Remove a key. Clear memory FIRST (so an in-flight read can't repopulate) and
 * re-derive the scope synchronously — consumers (e.g. the reactive session
 * scope on logout) see the drop immediately, before the slower keychain delete.
 */
export async function removeCached(key: CacheKey): Promise<void> {
  memory.set(key, null);
  rebuildScope();
  await SecureStore.deleteItemAsync(key);
}

/**
 * Bump the generation so any in-flight read is discarded on resolve. Call on
 * every logout / account switch / event switch, before or alongside removals.
 */
export function bumpGeneration(): void {
  generation += 1;
  inflight.clear();
}

/** Mint + persist a fresh non-secret session id (called at login). */
export async function mintSessionId(): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await setCached('session_id', id);
  return id;
}

/** Reactive subscription for `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot of the current scope (same reference until it changes). */
export function getScope(): QueryScope | null {
  return currentScope;
}

/** Test-only: wipe memory + listeners so suites do not leak session state. */
export function _resetForTests(): void {
  memory.clear();
  inflight.clear();
  listeners.clear();
  generation = 0;
  currentScope = null;
  primePromise = null;
}
