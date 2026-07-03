/**
 * Persistence of the pending-erasure recovery state.
 *
 * When a guest schedules deletion via `requestErasure()` the backend returns
 * the plain-text `recovery_token` exactly once — the DB only keeps a
 * sha256-hash. Losing that token means the guest can no longer revoke the
 * request via the app. This module owns three SecureStore keys that survive
 * logout (unlike the session keys in `lib/auth.ts`), so the pending-erasure
 * screen remains reachable after the sanctum bearer has been revoked.
 *
 * Storage keys:
 *   - `erasure_recovery_token` .... plain token, needed for the revoke API
 *   - `erasure_scheduled_at` ...... ISO timestamp: when hard delete happens
 *   - `erasure_can_revoke_until` .. ISO timestamp: grace window end
 *
 * All three are written together via `saveErasureState` and cleared together
 * via `clearErasureState`. Partial reads are handled by treating a missing
 * `erasure_recovery_token` as "no pending erasure" — same sentinel pattern
 * as `getSession()` uses for the bearer token.
 */
import * as SecureStore from 'expo-secure-store';

/** Shape written to SecureStore + returned by `getErasureState`. */
export type ErasureState = {
  recoveryToken: string;
  scheduledAt: string;
  canRevokeUntil: string;
};

/**
 * Persist the fields returned by `POST /api/guest/erasure`. Must be called
 * BEFORE clearing the session — losing the recovery token means the guest
 * has no way to revoke via the app.
 */
export async function saveErasureState(state: ErasureState): Promise<void> {
  await SecureStore.setItemAsync('erasure_recovery_token', state.recoveryToken);
  await SecureStore.setItemAsync('erasure_scheduled_at', state.scheduledAt);
  await SecureStore.setItemAsync('erasure_can_revoke_until', state.canRevokeUntil);
}

/**
 * Read the persisted erasure state, or `null` when no erasure is pending.
 * The recovery token is the sentinel; missing token = no pending erasure
 * regardless of what the two timestamp keys hold.
 */
export async function getErasureState(): Promise<ErasureState | null> {
  const recoveryToken = await SecureStore.getItemAsync('erasure_recovery_token');
  if (!recoveryToken) return null;
  const scheduledAt = await SecureStore.getItemAsync('erasure_scheduled_at');
  const canRevokeUntil = await SecureStore.getItemAsync('erasure_can_revoke_until');
  return {
    recoveryToken,
    scheduledAt: scheduledAt ?? '',
    canRevokeUntil: canRevokeUntil ?? '',
  };
}

/**
 * Wipe every erasure-related key. Called after a successful revoke, or as a
 * defensive cleanup on startup once the revoke window has expired.
 */
export async function clearErasureState(): Promise<void> {
  await SecureStore.deleteItemAsync('erasure_recovery_token');
  await SecureStore.deleteItemAsync('erasure_scheduled_at');
  await SecureStore.deleteItemAsync('erasure_can_revoke_until');
}
