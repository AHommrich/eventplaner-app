import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

const mockPost = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { post: (...args: any[]) => mockPost(...args) },
}));

const mockSetActiveManagementEvent = jest.fn();
const mockRetryPendingManagementLogout = jest.fn();
jest.mock('../../lib/management', () => ({
  __esModule: true,
  setActiveManagementEvent: (...args: any[]) => mockSetActiveManagementEvent(...args),
  retryPendingManagementLogout: (...args: any[]) => mockRetryPendingManagementLogout(...args),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } },
}));

import {
  openManagementNotification,
  openInitialManagementNotification,
  getManagementPushEnabled,
  initializeManagementPushNotifications,
  registerManagementPushToken,
  setManagementPushEnabled,
  unregisterManagementPushToken,
} from '../../lib/managementPush';

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

function notificationResponse(data: Record<string, unknown>): Notifications.NotificationResponse {
  return {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { content: { data } } },
  } as Notifications.NotificationResponse;
}

describe('management push notifications', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await SecureStore.deleteItemAsync('management_token');
    await SecureStore.deleteItemAsync('management_expo_push_token');
    await SecureStore.deleteItemAsync('management_push_enabled');
    mockedNotifications.getPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
    } as Notifications.NotificationPermissionsStatus);
    mockedNotifications.getExpoPushTokenAsync.mockResolvedValue({
      type: 'expo',
      data: 'ExponentPushToken[test-device]',
    });
    mockPost.mockResolvedValue({ data: { enabled: true } });
    mockSetActiveManagementEvent.mockResolvedValue(undefined);
    mockRetryPendingManagementLogout.mockResolvedValue(undefined);
  });

  it('registers an Expo token only for an organizer session', async () => {
    await expect(registerManagementPushToken()).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();

    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    await expect(registerManagementPushToken()).resolves.toBe('ExponentPushToken[test-device]');

    expect(mockedNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'project-id',
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/api/management/push/register',
      expect.objectContaining({ expo_token: 'ExponentPushToken[test-device]' })
    );
    expect(await SecureStore.getItemAsync('management_expo_push_token')).toBe(
      'ExponentPushToken[test-device]'
    );
  });

  it('does not register when notification permission is declined', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    mockedNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    } as Notifications.NotificationPermissionsStatus);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    } as Notifications.NotificationPermissionsStatus);

    await expect(registerManagementPushToken()).resolves.toBeNull();
    expect(mockedNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('switches event and opens the matching note from a notification tap', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');

    await expect(
      openManagementNotification(
        notificationResponse({ type: 'assigned_note', event_id: 4, note_id: 12 })
      )
    ).resolves.toBe(true);

    expect(mockSetActiveManagementEvent).toHaveBeenCalledWith(4);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizer/notes',
      params: { noteId: '12' },
    });
  });

  it('opts the stored device out during organizer logout', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    await SecureStore.setItemAsync('management_expo_push_token', 'ExponentPushToken[test-device]');

    await unregisterManagementPushToken();

    expect(mockPost).toHaveBeenCalledWith('/api/management/push/register', { enabled: false });
    expect(await SecureStore.getItemAsync('management_expo_push_token')).toBe(
      'ExponentPushToken[test-device]'
    );
  });

  it('stores an explicit opt-in and opt-out preference', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');

    await expect(setManagementPushEnabled(true)).resolves.toBe(true);
    await expect(getManagementPushEnabled()).resolves.toBe(true);

    await expect(setManagementPushEnabled(false)).resolves.toBe(false);
    await expect(getManagementPushEnabled()).resolves.toBe(false);
  });

  it('serializes a cold-start notification before the welcome redirect', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    mockedNotifications.getLastNotificationResponseAsync.mockResolvedValueOnce(
      notificationResponse({ type: 'assigned_note', event_id: 9, note_id: 21 })
    );

    await expect(openInitialManagementNotification()).resolves.toBe(true);

    expect(mockSetActiveManagementEvent).toHaveBeenCalledWith(9);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizer/notes',
      params: { noteId: '21' },
    });
    expect(mockedNotifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('rebinds a rotated Expo token while push remains opted in', async () => {
    const dispose = initializeManagementPushNotifications();
    const listener = (mockedNotifications.addPushTokenListener as jest.Mock).mock.calls.at(-1)[0];
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    await SecureStore.setItemAsync('management_push_enabled', 'true');
    mockedNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      type: 'expo',
      data: 'ExpoPushToken[rotated-device]',
    });
    mockPost.mockClear();

    listener({ type: 'ios', data: 'native-apns-token' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockPost).toHaveBeenCalledWith('/api/management/push/register', {
      expo_token: 'ExpoPushToken[rotated-device]',
      platform: expect.any(String),
    });
    expect(await SecureStore.getItemAsync('management_expo_push_token')).toBe(
      'ExpoPushToken[rotated-device]'
    );
    dispose();
  });
});
