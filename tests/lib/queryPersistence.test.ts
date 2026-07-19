/**
 * `lib/queryPersistence` — CP6 offline cache with GDPR guarantees.
 *
 * The security-critical properties: only allowlisted, non-auth query roots may
 * persist, and a purge removes everything from disk + memory.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '../../lib/queryClient';
import {
  PERSIST_CACHE_KEY,
  initQueryPersistence,
  purgePersistedCache,
  shouldPersistQuery,
} from '../../lib/queryPersistence';

/** Build a minimal Query-like object for the real dehydrate predicate. */
function fakeQuery(queryKey: unknown[], status: 'success' | 'error' = 'success') {
  return { queryKey, state: { status } } as any;
}

const SCOPE = ['guest', 1, 'sess-abc'];

describe('lib/queryPersistence — real dehydrate filter', () => {
  it('persists allowlisted, scope-isolated, successful reads', () => {
    for (const root of ['eventInfo', 'photos', 'managementEvents', 'managementSchedule']) {
      expect(shouldPersistQuery(fakeQuery([root, ...SCOPE]))).toBe(true);
    }
  });

  it('never persists sensitive/non-allowlisted roots', () => {
    for (const root of [
      'guestMe',
      'notes',
      'managementPhotos',
      'photoGameStatus',
      'hiddenGuests',
    ]) {
      expect(shouldPersistQuery(fakeQuery([root, ...SCOPE]))).toBe(false);
    }
  });

  it('rejects the anonymous scope (signed-out ["anon", 0, ""])', () => {
    expect(shouldPersistQuery(fakeQuery(['eventInfo', 'anon', 0, '']))).toBe(false);
  });

  it('rejects a valid root that has no successful result', () => {
    expect(shouldPersistQuery(fakeQuery(['photos', ...SCOPE], 'error'))).toBe(false);
  });

  it('rejects an empty sessionId even under an allowlisted root', () => {
    expect(shouldPersistQuery(fakeQuery(['photos', 'guest', 1, '']))).toBe(false);
  });
});

describe('lib/queryPersistence — purge', () => {
  it('clears the in-memory client and removes the on-disk blob', async () => {
    initQueryPersistence();
    queryClient.setQueryData(['eventInfo', 'guest', 1, 'sess'], { name: 'X' });
    await AsyncStorage.setItem(PERSIST_CACHE_KEY, JSON.stringify({ some: 'cache' }));

    await purgePersistedCache();

    expect(queryClient.getQueryData(['eventInfo', 'guest', 1, 'sess'])).toBeUndefined();
    expect(await AsyncStorage.getItem(PERSIST_CACHE_KEY)).toBeNull();
  });
});
