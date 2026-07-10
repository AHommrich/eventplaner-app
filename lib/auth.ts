/**
 * Guest-session persistence.
 *
 * A "session" here is a bundle of identifying strings the app needs on every
 * screen: the bearer token, the numeric guest id, the display name and the
 * guest type (solo vs family). All of it lives in `expo-secure-store` —
 * intentionally NOT in AsyncStorage. Reason: SecureStore is Keychain on iOS
 * and encrypted-SharedPreferences on Android; the bearer token functions as
 * a password because tokens are intentionally long-lived for event UX.
 * Storing it in plaintext would expose an unrevokable credential to any
 * process that reads app-private storage.
 *
 * Each field lives under its own key so the storage layer can be partially
 * cleared (e.g. on server-side "already logged in" errors) without invalidating
 * the whole bundle.
 */
import * as SecureStore from 'expo-secure-store';
import api, { resetUnauthorizedRedirect } from './api';
import { deleteGuestSession } from './sessionStorage';

/** Shape passed to `saveSession` and returned by `getSession`. */
export type GuestSession = {
  token: string;
  guestId: number;
  firstname: string;
  lastname: string;
  type: 'solo' | 'family';
  familyName: string | null;
};

/**
 * Persist a freshly minted session after the two-step QR login completes.
 * Callers should redirect to `/` immediately after — `app/index.tsx` reads
 * this back synchronously to pick the right post-login route.
 */
export async function saveSession(session: GuestSession): Promise<void> {
  resetUnauthorizedRedirect();
  await SecureStore.setItemAsync('guest_token', session.token);
  await SecureStore.setItemAsync('guest_id', String(session.guestId));
  await SecureStore.setItemAsync('guest_firstname', session.firstname);
  await SecureStore.setItemAsync('guest_lastname', session.lastname);
  await SecureStore.setItemAsync('guest_type', session.type);
  if (session.familyName) {
    await SecureStore.setItemAsync('guest_family_name', session.familyName);
  }
}

/**
 * Read the persisted session, or `null` when the guest has never logged in
 * (missing token). The token is treated as the sentinel — every other field
 * defaults to a safe placeholder so a partially corrupted store cannot crash
 * the render tree.
 */
export async function getSession(): Promise<GuestSession | null> {
  const token = await SecureStore.getItemAsync('guest_token');
  if (!token) return null;

  const guestId = await SecureStore.getItemAsync('guest_id');
  const firstname = await SecureStore.getItemAsync('guest_firstname');
  const lastname = await SecureStore.getItemAsync('guest_lastname');
  const type = await SecureStore.getItemAsync('guest_type');
  const familyName = await SecureStore.getItemAsync('guest_family_name');

  return {
    token,
    guestId: Number(guestId),
    firstname: firstname ?? '',
    lastname: lastname ?? '',
    type: (type as 'solo' | 'family') ?? 'solo',
    familyName: familyName ?? null,
  };
}

/**
 * Log the guest out. Fires the backend logout endpoint first (best effort —
 * a lost network is not allowed to trap the guest on the app) and then
 * removes every persisted key. Local cleanup is always executed, so a
 * partial server outage still leaves the app in a coherent, logged-out
 * state on the next launch.
 */
export async function clearSession(): Promise<void> {
  try {
    await api.delete('/api/auth/logout');
  } catch {
    // Server-side revoke may fail (offline, backend down) — still clear
    // locally so the next launch does not think we're logged in.
  }
  await deleteGuestSession();
}
