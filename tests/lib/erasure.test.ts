/**
 * `lib/erasure` — persistence of the pending-erasure recovery state.
 *
 * The tests exercise the SecureStore round-trip via the mock installed in
 * `tests/setup.ts` and verify the sentinel behaviour: a missing
 * `erasure_recovery_token` key is treated as "no erasure pending"
 * regardless of what the two timestamp keys hold.
 */
import * as SecureStore from 'expo-secure-store';
import {
  saveErasureState,
  getErasureState,
  clearErasureState,
} from '../../lib/erasure';

const KEYS = [
  'erasure_recovery_token',
  'erasure_scheduled_at',
  'erasure_can_revoke_until',
];

describe('lib/erasure', () => {
  beforeEach(async () => {
    for (const k of KEYS) {
      await SecureStore.deleteItemAsync(k);
    }
  });

  it('returns null when nothing has ever been saved', async () => {
    expect(await getErasureState()).toBeNull();
  });

  it('saveErasureState + getErasureState round-trip preserves every field', async () => {
    await saveErasureState({
      recoveryToken: 'plain-token',
      scheduledAt: '2026-08-02T12:00:00Z',
      canRevokeUntil: '2026-08-02T12:00:00Z',
    });
    const state = await getErasureState();
    expect(state).toEqual({
      recoveryToken: 'plain-token',
      scheduledAt: '2026-08-02T12:00:00Z',
      canRevokeUntil: '2026-08-02T12:00:00Z',
    });
  });

  it('treats a missing recovery token as no pending erasure', async () => {
    // Simulate a corrupted store: timestamps present, token deleted.
    await SecureStore.setItemAsync('erasure_scheduled_at', '2026-08-02T12:00:00Z');
    await SecureStore.setItemAsync('erasure_can_revoke_until', '2026-08-02T12:00:00Z');
    expect(await getErasureState()).toBeNull();
  });

  it('falls back to empty strings when timestamps are missing but token exists', async () => {
    // Defensive: token present but partial store. The screen renders "—"
    // rather than crash.
    await SecureStore.setItemAsync('erasure_recovery_token', 'plain-token');
    const state = await getErasureState();
    expect(state).toEqual({
      recoveryToken: 'plain-token',
      scheduledAt: '',
      canRevokeUntil: '',
    });
  });

  it('clearErasureState wipes every key', async () => {
    await saveErasureState({
      recoveryToken: 'plain-token',
      scheduledAt: '2026-08-02T12:00:00Z',
      canRevokeUntil: '2026-08-02T12:00:00Z',
    });
    await clearErasureState();
    for (const k of KEYS) {
      expect(await SecureStore.getItemAsync(k)).toBeNull();
    }
    expect(await getErasureState()).toBeNull();
  });
});
