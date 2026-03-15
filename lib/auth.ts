import * as SecureStore from 'expo-secure-store';
import api from './api';

export type GuestSession = {
  token: string;
  guestId: number;
  firstname: string;
  lastname: string;
  type: 'solo' | 'family';
  familyName: string | null;
};

export async function saveSession(session: GuestSession): Promise<void> {
  await SecureStore.setItemAsync('guest_token', session.token);
  await SecureStore.setItemAsync('guest_id', String(session.guestId));
  await SecureStore.setItemAsync('guest_firstname', session.firstname);
  await SecureStore.setItemAsync('guest_lastname', session.lastname);
  await SecureStore.setItemAsync('guest_type', session.type);
  if (session.familyName) {
    await SecureStore.setItemAsync('guest_family_name', session.familyName);
  }
}

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

export async function clearSession(): Promise<void> {
  try {
    await api.delete('/api/auth/logout');
  } catch {
    // Token serverseitig löschen schlägt ggf. fehl — lokal trotzdem aufräumen
  }
  await SecureStore.deleteItemAsync('guest_token');
  await SecureStore.deleteItemAsync('guest_id');
  await SecureStore.deleteItemAsync('guest_firstname');
  await SecureStore.deleteItemAsync('guest_lastname');
  await SecureStore.deleteItemAsync('guest_type');
  await SecureStore.deleteItemAsync('guest_family_name');
}
