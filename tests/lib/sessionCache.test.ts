/**
 * `lib/sessionCache` — the in-memory write-through session cache (Checkpoint 1).
 *
 * The security-critical guarantee under test is the generation counter: a
 * keychain read that started before logout must never repopulate the cache
 * with the token it read. The global reset in `tests/setupAfterEnv.ts` clears
 * the cache + SecureStore mock before each test; here we also clear the mock's
 * call history so read counts are meaningful.
 */
import * as SecureStore from 'expo-secure-store';
import {
  getCached,
  setCached,
  removeCached,
  bumpGeneration,
  mintSessionId,
  primeFromStore,
  getScope,
  subscribe,
} from '../../lib/sessionCache';

const getItem = SecureStore.getItemAsync as jest.Mock;

beforeEach(() => {
  getItem.mockClear();
});

describe('lib/sessionCache — read-through with dedup', () => {
  it('reads a key from SecureStore once, then serves memory', async () => {
    await SecureStore.setItemAsync('guest_token', 'tok');
    getItem.mockClear();

    expect(await getCached('guest_token')).toBe('tok');
    expect(await getCached('guest_token')).toBe('tok');
    expect(await getCached('guest_token')).toBe('tok');
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('caches absence (null) without re-reading', async () => {
    expect(await getCached('guest_token')).toBeNull();
    expect(await getCached('guest_token')).toBeNull();
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent in-flight reads into one SecureStore call', async () => {
    await SecureStore.setItemAsync('guest_token', 'tok');
    getItem.mockClear();

    const [a, b] = await Promise.all([getCached('guest_token'), getCached('guest_token')]);
    expect(a).toBe('tok');
    expect(b).toBe('tok');
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});

describe('lib/sessionCache — write-through', () => {
  it('setCached writes SecureStore and memory (no later read)', async () => {
    await setCached('guest_token', 'new');
    const store = (globalThis as unknown as { __secureStore: Map<string, string> }).__secureStore;
    expect(store.get('guest_token')).toBe('new');
    getItem.mockClear();
    expect(await getCached('guest_token')).toBe('new');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('removeCached clears the value from both memory and SecureStore', async () => {
    await setCached('guest_token', 'x');
    await removeCached('guest_token');
    expect(await getCached('guest_token')).toBeNull();
  });
});

describe('lib/sessionCache — generation race guard (security gate)', () => {
  it('does not let a read started before logout repopulate a stale token', async () => {
    await SecureStore.setItemAsync('guest_token', 'stale');

    // Read starts while nothing is cached — it will resolve to 'stale'.
    const inFlight = getCached('guest_token');
    // Logout happens mid-flight: bump the generation, then clear.
    bumpGeneration();
    await removeCached('guest_token');
    // The in-flight read now resolves — it must NOT resurrect 'stale'.
    await inFlight;

    expect(await getCached('guest_token')).toBeNull();
  });
});

describe('lib/sessionCache — primeFromStore dedup', () => {
  it('collapses concurrent primes into a single keychain sweep', async () => {
    getItem.mockClear();
    await Promise.all([primeFromStore(), primeFromStore()]);
    // Exactly one read per cache key, not two sweeps.
    expect(getItem).toHaveBeenCalledTimes(7);
  });
});

describe('lib/sessionCache — removeCached drops scope synchronously', () => {
  it('clears the reactive scope before the keychain delete resolves', async () => {
    await setCached('guest_token', 't');
    await setCached('guest_id', '1');
    await mintSessionId();
    expect(getScope()).not.toBeNull();

    // Do NOT await: memory + scope must update synchronously, before the slower
    // SecureStore delete settles, so a logout consumer sees the drop at once.
    const pending = removeCached('guest_token');
    expect(getScope()).toBeNull();
    await pending;
  });
});

describe('lib/sessionCache — scope', () => {
  it('derives a guest scope only once token + id + sessionId are present', async () => {
    expect(getScope()).toBeNull();
    await setCached('guest_token', 't');
    await setCached('guest_id', '42');
    expect(getScope()).toBeNull(); // no sessionId yet
    await mintSessionId();
    expect(getScope()).toMatchObject({ actor: 'guest', guestId: 42 });
  });

  it('derives a management scope with user + event ids', async () => {
    await setCached('management_token', 'm');
    await setCached('management_user_id', '5');
    await setCached('management_active_event_id', '17');
    await mintSessionId();
    expect(getScope()).toMatchObject({ actor: 'management', userId: 5, eventId: 17 });
  });

  it('notifies subscribers when the scope changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);
    await setCached('guest_token', 't');
    await setCached('guest_id', '1');
    await mintSessionId();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
