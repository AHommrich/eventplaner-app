/** Organizer authentication, event bootstrap, and SecureStore persistence. */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api, { resetUnauthorizedRedirect } from './api';
import type { EventThemePayload } from './guest';
import { deleteGuestSession, deleteManagementSession } from './sessionStorage';

export type ManagementUser = {
  id: number;
  name: string;
  email: string;
};

export type ManagementSession = ManagementUser & {
  token: string;
};

export type ManagementRole = 'owner' | 'event_admin' | 'event_manager' | 'superadmin';

export type ManagementEvent = {
  id: number;
  name: string;
  date: string | null;
  my_role: ManagementRole;
  theme: EventThemePayload;
};

type AuthResponse = {
  token: string;
  user: ManagementUser;
  event: Omit<ManagementEvent, 'theme'>;
};

const deviceName = `eveplan ${Platform.OS === 'ios' ? 'iPhone' : 'Android'}`;
const PENDING_LOGOUT_TOKENS_KEY = 'management_pending_logout_tokens';

async function getPendingLogoutTokens(): Promise<string[]> {
  const value = await SecureStore.getItemAsync(PENDING_LOGOUT_TOKENS_KEY);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((token): token is string => typeof token === 'string'))]
      : [];
  } catch {
    return [];
  }
}

async function setPendingLogoutTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    await SecureStore.deleteItemAsync(PENDING_LOGOUT_TOKENS_KEY);
    return;
  }

  await SecureStore.setItemAsync(PENDING_LOGOUT_TOKENS_KEY, JSON.stringify([...new Set(tokens)]));
}

/**
 * Pairing secrets are exactly 64 alphanumeric characters; invitation tokens
 * are exactly 32. Detect locally so a management secret is never sent in a
 * guest-auth URL while the app can keep one seamless scanner entry point.
 */
export function isManagementPairingToken(token: string): boolean {
  return /^[A-Za-z0-9]{64}$/.test(token);
}

export async function saveManagementSession(response: AuthResponse): Promise<ManagementSession> {
  resetUnauthorizedRedirect();
  await deleteGuestSession();
  await SecureStore.setItemAsync('management_token', response.token);
  await SecureStore.setItemAsync('management_user_id', String(response.user.id));
  await SecureStore.setItemAsync('management_user_name', response.user.name);
  await SecureStore.setItemAsync('management_user_email', response.user.email);
  await SecureStore.setItemAsync('management_active_event_id', String(response.event.id));

  return { token: response.token, ...response.user };
}

export async function getManagementSession(): Promise<ManagementSession | null> {
  const token = await SecureStore.getItemAsync('management_token');
  if (!token) return null;

  const [id, name, email] = await Promise.all([
    SecureStore.getItemAsync('management_user_id'),
    SecureStore.getItemAsync('management_user_name'),
    SecureStore.getItemAsync('management_user_email'),
  ]);

  return {
    token,
    id: Number(id),
    name: name ?? '',
    email: email ?? '',
  };
}

export async function redeemManagementPairing(token: string): Promise<ManagementSession> {
  const response = await api.post<AuthResponse>('/api/auth/pair', {
    token,
    device_name: deviceName,
  });

  return saveManagementSession(response.data);
}

export async function fetchManagementEvents(): Promise<ManagementEvent[]> {
  const response = await api.get<{ events: ManagementEvent[] }>('/api/management/me/events');
  return response.data.events;
}

export async function getActiveManagementEventId(): Promise<number | null> {
  const value = await SecureStore.getItemAsync('management_active_event_id');
  return value ? Number(value) : null;
}

export async function setActiveManagementEvent(eventId: number): Promise<void> {
  await SecureStore.setItemAsync('management_active_event_id', String(eventId));
}

export async function ensureActiveManagementEvent(
  events: ManagementEvent[]
): Promise<number | null> {
  if (events.length === 0) {
    await SecureStore.deleteItemAsync('management_active_event_id');
    return null;
  }
  if (events.length !== 1) {
    await SecureStore.deleteItemAsync('management_active_event_id');
    throw new Error('A management device session must resolve exactly one event.');
  }

  await setActiveManagementEvent(events[0].id);
  return events[0].id;
}

export async function clearManagementSession(): Promise<void> {
  const token = await SecureStore.getItemAsync('management_token');
  try {
    await api.delete('/api/auth/logout');
  } catch {
    // Keep a non-interactive copy solely so a later app start can finish
    // server-side revocation. It is never returned by getManagementSession().
    if (token) await setPendingLogoutTokens([...(await getPendingLogoutTokens()), token]);
  }
  await deleteManagementSession();
}

export async function retryPendingManagementLogout(): Promise<void> {
  const pending = await getPendingLogoutTokens();
  const remaining: string[] = [];

  for (const token of pending) {
    try {
      await api.delete('/api/auth/logout', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      // 401 means the bearer was already revoked/expired, which is also success.
      if ((error as { response?: { status?: number } }).response?.status !== 401) {
        remaining.push(token);
      }
    }
  }

  await setPendingLogoutTokens(remaining);
}
