/**
 * Shared storage helpers for guest-session keys.
 *
 * Kept outside `lib/auth.ts` so the axios interceptor can clear a revoked
 * local session without importing `auth` and creating an api/auth cycle.
 */
import * as SecureStore from 'expo-secure-store';

export const GUEST_SESSION_KEYS = [
  'guest_token',
  'guest_id',
  'guest_firstname',
  'guest_lastname',
  'guest_type',
  'guest_family_name',
] as const;

export async function deleteGuestSession(): Promise<void> {
  await Promise.all(GUEST_SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
}
