/**
 * Shared storage helpers for guest-session keys.
 *
 * Kept outside `lib/auth.ts` so the axios interceptor can clear a revoked
 * local session without importing `auth` and creating an api/auth cycle.
 */
import * as SecureStore from 'expo-secure-store';
import { bumpGeneration, removeCached } from './sessionCache';

export const GUEST_SESSION_KEYS = [
  'guest_token',
  'guest_id',
  'guest_firstname',
  'guest_lastname',
  'guest_type',
  'guest_family_name',
] as const;

export const MANAGEMENT_SESSION_KEYS = [
  'management_token',
  'management_user_id',
  'management_user_name',
  'management_user_email',
  'management_active_event_id',
] as const;

// Guest + management sessions are mutually exclusive, so `session_id` (the
// non-secret scope id) is cleared by whichever teardown runs.

export async function deleteGuestSession(): Promise<void> {
  // Bump first so any in-flight cache read is discarded on resolve — a token
  // read racing this logout must never repopulate the cache. `removeCached`
  // clears the memory value synchronously before its await, so running the
  // removals in parallel keeps the cache coherent while finishing in one tick.
  bumpGeneration();
  await Promise.all([
    removeCached('guest_token'),
    removeCached('guest_id'),
    removeCached('session_id'),
    SecureStore.deleteItemAsync('guest_firstname'),
    SecureStore.deleteItemAsync('guest_lastname'),
    SecureStore.deleteItemAsync('guest_type'),
    SecureStore.deleteItemAsync('guest_family_name'),
  ]);
}

export async function deleteManagementSession(): Promise<void> {
  bumpGeneration();
  await Promise.all([
    removeCached('management_token'),
    removeCached('management_user_id'),
    removeCached('management_active_event_id'),
    removeCached('session_id'),
    SecureStore.deleteItemAsync('management_user_name'),
    SecureStore.deleteItemAsync('management_user_email'),
  ]);
}
