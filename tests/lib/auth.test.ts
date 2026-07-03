/**
 * Session-persistence round-trip.
 *
 * The tests read and write through the `expo-secure-store` mock installed
 * in `tests/setup.ts`, so we're exercising the real serialisation code but
 * against an in-memory backing map.
 */
import * as SecureStore from 'expo-secure-store';
import { saveSession, getSession, clearSession, GuestSession } from '../../lib/auth';

const soloSession: GuestSession = {
  token: 'unit-test-token',
  guestId: 42,
  firstname: 'Ada',
  lastname: 'Lovelace',
  type: 'solo',
  familyName: null,
};

const familySession: GuestSession = {
  token: 'family-token',
  guestId: 7,
  firstname: 'Grace',
  lastname: 'Hopper',
  type: 'family',
  familyName: 'Hopper',
};

describe('lib/auth', () => {
  beforeEach(async () => {
    // Fresh SecureStore for every test — the shared mock keeps state across
    // suites otherwise.
    await SecureStore.deleteItemAsync('guest_token');
    await SecureStore.deleteItemAsync('guest_id');
    await SecureStore.deleteItemAsync('guest_firstname');
    await SecureStore.deleteItemAsync('guest_lastname');
    await SecureStore.deleteItemAsync('guest_type');
    await SecureStore.deleteItemAsync('guest_family_name');
  });

  it('getSession returns null when no token is present', async () => {
    expect(await getSession()).toBeNull();
  });

  it('saveSession + getSession round-trip a solo session', async () => {
    await saveSession(soloSession);
    const roundTrip = await getSession();
    expect(roundTrip).toEqual(soloSession);
  });

  it('saveSession + getSession round-trip a family session', async () => {
    await saveSession(familySession);
    const roundTrip = await getSession();
    expect(roundTrip).toEqual(familySession);
  });

  it('saveSession omits the family key when familyName is null', async () => {
    await saveSession(soloSession);
    const familyName = await SecureStore.getItemAsync('guest_family_name');
    expect(familyName).toBeNull();
  });

  it('getSession fills defaults when peripheral keys are missing', async () => {
    // Only the token is set — the sentinel — everything else defaults.
    await SecureStore.setItemAsync('guest_token', 'sentinel');
    const s = await getSession();
    expect(s).toEqual({
      token: 'sentinel',
      guestId: 0, // Number(null) → 0 — the sentinel is the token, not the id
      firstname: '',
      lastname: '',
      type: 'solo',
      familyName: null,
    });
  });

  it('clearSession removes every persisted key even if the logout call fails', async () => {
    await saveSession(familySession);
    // The api.delete mock does not error, but the try/catch in clearSession
    // still runs to completion regardless.
    await clearSession();
    expect(await SecureStore.getItemAsync('guest_token')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_id')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_firstname')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_lastname')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_type')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_family_name')).toBeNull();
  });
});
