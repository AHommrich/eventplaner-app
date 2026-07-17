import * as SecureStore from 'expo-secure-store';

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
    get: (...args: any[]) => mockGet(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
  resetUnauthorizedRedirect: jest.fn(),
}));

import {
  clearManagementSession,
  ensureActiveManagementEvent,
  fetchManagementEvents,
  getManagementSession,
  isManagementPairingToken,
  redeemManagementPairing,
  retryPendingManagementLogout,
  saveManagementSession,
} from '../../lib/management';

const response = {
  token: 'management-bearer',
  user: { id: 7, name: 'Ada Admin', email: 'ada@example.test' },
};

describe('lib/management', () => {
  beforeEach(async () => {
    mockPost.mockReset();
    mockGet.mockReset();
    mockDelete.mockReset();
    for (const key of [
      'management_token',
      'management_user_id',
      'management_user_name',
      'management_user_email',
      'management_active_event_id',
      'management_pending_logout_tokens',
      'guest_token',
    ]) {
      await SecureStore.deleteItemAsync(key);
    }
  });

  it('round-trips an organizer session and removes an old guest bearer', async () => {
    await SecureStore.setItemAsync('guest_token', 'old-guest');
    await saveManagementSession(response);

    expect(await getManagementSession()).toEqual({
      token: 'management-bearer',
      id: 7,
      name: 'Ada Admin',
      email: 'ada@example.test',
    });
    expect(await SecureStore.getItemAsync('guest_token')).toBeNull();
  });

  it('distinguishes 64-character pairing secrets from guest invitation tokens', () => {
    expect(isManagementPairingToken('A'.repeat(64))).toBe(true);
    expect(isManagementPairingToken('A'.repeat(32))).toBe(false);
    expect(isManagementPairingToken('!'.repeat(64))).toBe(false);
  });

  it('redeems a one-time pairing token through the dedicated endpoint', async () => {
    mockPost.mockResolvedValue({ data: response });

    await redeemManagementPairing('pairing-secret');

    expect(mockPost).toHaveBeenCalledWith(
      '/api/auth/pair',
      expect.objectContaining({ token: 'pairing-secret' })
    );
  });

  it('loads accessible events and keeps or repairs the active event', async () => {
    const events = [
      { id: 11, name: 'First', date: null, my_role: 'owner' as const },
      { id: 12, name: 'Second', date: null, my_role: 'event_manager' as const },
    ];
    mockGet.mockResolvedValue({ data: { events } });

    expect(await fetchManagementEvents()).toEqual(events);
    expect(await ensureActiveManagementEvent(events)).toBe(11);
    expect(await SecureStore.getItemAsync('management_active_event_id')).toBe('11');

    await SecureStore.setItemAsync('management_active_event_id', '12');
    expect(await ensureActiveManagementEvent(events)).toBe(12);
  });

  it('clears the interactive session but retains an offline revocation credential', async () => {
    await saveManagementSession(response);
    await SecureStore.setItemAsync('management_active_event_id', '11');
    mockDelete.mockRejectedValue(new Error('offline'));

    await clearManagementSession();

    expect(await getManagementSession()).toBeNull();
    expect(await SecureStore.getItemAsync('management_active_event_id')).toBeNull();
    expect(
      JSON.parse((await SecureStore.getItemAsync('management_pending_logout_tokens'))!)
    ).toEqual(['management-bearer']);
  });

  it('retries and clears a pending server-side logout', async () => {
    await SecureStore.setItemAsync(
      'management_pending_logout_tokens',
      JSON.stringify(['pending-bearer'])
    );
    mockDelete.mockResolvedValue({ data: {} });

    await retryPendingManagementLogout();

    expect(mockDelete).toHaveBeenCalledWith('/api/auth/logout', {
      headers: { Authorization: 'Bearer pending-bearer' },
    });
    expect(await SecureStore.getItemAsync('management_pending_logout_tokens')).toBeNull();
  });

  it('queues multiple offline logouts without overwriting an older bearer', async () => {
    mockDelete.mockRejectedValue(new Error('offline'));
    await saveManagementSession(response);
    await clearManagementSession();
    await saveManagementSession({ ...response, token: 'second-bearer' });
    await clearManagementSession();

    expect(
      JSON.parse((await SecureStore.getItemAsync('management_pending_logout_tokens'))!)
    ).toEqual(['management-bearer', 'second-bearer']);
  });

  it('clears the active event when no events are accessible', async () => {
    await SecureStore.setItemAsync('management_active_event_id', '99');

    expect(await ensureActiveManagementEvent([])).toBeNull();
    expect(await SecureStore.getItemAsync('management_active_event_id')).toBeNull();
  });

  it('treats a corrupt pending-logout store as empty', async () => {
    await SecureStore.setItemAsync('management_pending_logout_tokens', '{not json');

    await retryPendingManagementLogout();

    expect(mockDelete).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync('management_pending_logout_tokens')).toBeNull();
  });

  it('keeps a pending logout token when the retry fails with a non-401 error', async () => {
    await SecureStore.setItemAsync(
      'management_pending_logout_tokens',
      JSON.stringify(['still-valid'])
    );
    mockDelete.mockRejectedValue({ response: { status: 500 } });

    await retryPendingManagementLogout();

    expect(
      JSON.parse((await SecureStore.getItemAsync('management_pending_logout_tokens'))!)
    ).toEqual(['still-valid']);
  });

  it('drops a pending logout token when the bearer is already revoked (401)', async () => {
    await SecureStore.setItemAsync('management_pending_logout_tokens', JSON.stringify(['revoked']));
    mockDelete.mockRejectedValue({ response: { status: 401 } });

    await retryPendingManagementLogout();

    expect(await SecureStore.getItemAsync('management_pending_logout_tokens')).toBeNull();
  });

  it('treats a non-array pending-logout store as empty', async () => {
    await SecureStore.setItemAsync('management_pending_logout_tokens', '{"unexpected":true}');

    await retryPendingManagementLogout();

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns empty name and email when only token and id are stored', async () => {
    await SecureStore.setItemAsync('management_token', 'bearer');
    await SecureStore.setItemAsync('management_user_id', '5');

    expect(await getManagementSession()).toEqual({ token: 'bearer', id: 5, name: '', email: '' });
  });

  it('clears an offline session without queuing when no bearer is stored', async () => {
    mockDelete.mockRejectedValue(new Error('offline'));

    await clearManagementSession();

    expect(await SecureStore.getItemAsync('management_pending_logout_tokens')).toBeNull();
  });
});
