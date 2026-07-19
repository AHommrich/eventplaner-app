/**
 * Simulates an ALREADY-LOGGED-IN organizer whose install predates CP1: their
 * SecureStore has management_token + ids but NO session_id (that key is new).
 * If deriveScope() hard-requires a persisted session_id, their scope resolves
 * to null after the update and every scope-gated query/screen breaks.
 */
import * as SecureStore from 'expo-secure-store';
import { primeFromStore, getScope } from '../../lib/sessionCache';

describe('sessionCache — pre-CP1 session migration', () => {
  it('resolves a management scope for an existing session that has no session_id', async () => {
    // Pre-existing organizer session written by the OLD build (no session_id).
    await SecureStore.setItemAsync('management_token', 'existing-bearer');
    await SecureStore.setItemAsync('management_user_id', '5');
    await SecureStore.setItemAsync('management_active_event_id', '9');

    await primeFromStore();

    const scope = getScope();
    expect(scope).not.toBeNull();
    expect(scope?.actor).toBe('management');
  });

  it('resolves a guest scope for an existing guest session that has no session_id', async () => {
    await SecureStore.setItemAsync('guest_token', 'existing-guest');
    await SecureStore.setItemAsync('guest_id', '42');

    await primeFromStore();

    const scope = getScope();
    expect(scope).not.toBeNull();
    expect(scope?.actor).toBe('guest');
  });
});
