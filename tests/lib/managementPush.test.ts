import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

const mockPost = jest.fn();
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { post: (...args: any[]) => mockPost(...args) },
}));

const mockGetActiveManagementEventId = jest.fn();
const mockRetryPendingManagementLogout = jest.fn();
jest.mock('../../lib/management', () => ({
  __esModule: true,
  getActiveManagementEventId: (...args: any[]) => mockGetActiveManagementEventId(...args),
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
  syncManagementPushPreference,
  unregisterManagementPushToken,
} from '../../lib/managementPush';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

function withPlatform(os: string, run: () => Promise<void>): Promise<void> {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
  return run().finally(() => {
    Object.defineProperty(Platform, 'OS', { get: () => original, configurable: true });
  });
}

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
    mockGetActiveManagementEventId.mockResolvedValue(4);
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

  it('opens a matching bound-event note from a notification tap', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');

    await expect(
      openManagementNotification(
        notificationResponse({ type: 'assigned_note', event_id: 4, note_id: 12 })
      )
    ).resolves.toBe(true);

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
    mockGetActiveManagementEventId.mockResolvedValue(9);
    mockedNotifications.getLastNotificationResponseAsync.mockResolvedValueOnce(
      notificationResponse({ type: 'assigned_note', event_id: 9, note_id: 21 })
    );

    await expect(openInitialManagementNotification()).resolves.toBe(true);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizer/notes',
      params: { noteId: '21' },
    });
    expect(mockedNotifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('ignores a notification without valid assigned-note data', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');

    await expect(openManagementNotification(notificationResponse({ type: 'other' }))).resolves.toBe(
      false
    );
    await expect(
      openManagementNotification(
        notificationResponse({ type: 'assigned_note', event_id: 'x', note_id: 2 })
      )
    ).resolves.toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('ignores a notification for a different event than the bound session', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    mockGetActiveManagementEventId.mockResolvedValue(7);

    await expect(
      openManagementNotification(
        notificationResponse({ type: 'assigned_note', event_id: 4, note_id: 12 })
      )
    ).resolves.toBe(false);

    expect(router.push).not.toHaveBeenCalled();
  });

  it('creates the Android notification channel when registering on Android', async () => {
    await withPlatform('android', async () => {
      await SecureStore.setItemAsync('management_token', 'manager-bearer');

      await registerManagementPushToken();

      expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'organizer-tasks',
        expect.objectContaining({ importance: expect.anything() })
      );
    });
  });

  it('stays opted out when enabling but registration cannot yield a token', async () => {
    // No management_token in store → registerManagementPushToken() returns null.
    await expect(setManagementPushEnabled(true)).resolves.toBe(false);
    await expect(getManagementPushEnabled()).resolves.toBe(false);
  });

  it('syncs the push preference across the disabled/enabled/failed states', async () => {
    // Disabled (no preference, no stored token) → false.
    await expect(syncManagementPushPreference()).resolves.toBe(false);

    // Enabled preference but no organizer session yet → treated as satisfied.
    await SecureStore.setItemAsync('management_push_enabled', 'true');
    await expect(syncManagementPushPreference()).resolves.toBe(true);

    // Enabled + session + registration succeeds → true.
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    await expect(syncManagementPushPreference()).resolves.toBe(true);

    // Enabled + session but permission revoked → clears the stale opt-in.
    await SecureStore.setItemAsync('management_push_enabled', 'true');
    mockedNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    } as Notifications.NotificationPermissionsStatus);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    } as Notifications.NotificationPermissionsStatus);

    await expect(syncManagementPushPreference()).resolves.toBe(false);
    expect(await SecureStore.getItemAsync('management_push_enabled')).toBe('false');
  });

  it('shows a banner and routes a tapped notification through the listeners', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    mockGetActiveManagementEventId.mockResolvedValue(3);
    const dispose = initializeManagementPushNotifications();

    const handler = (mockedNotifications.setNotificationHandler as jest.Mock).mock.calls.at(-1)[0];
    await expect(handler.handleNotification()).resolves.toEqual(
      expect.objectContaining({ shouldShowBanner: true })
    );

    const respListener = (
      mockedNotifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.calls.at(-1)[0];
    respListener(notificationResponse({ type: 'assigned_note', event_id: 3, note_id: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizer/notes',
      params: { noteId: '7' },
    });
    dispose();
  });

  it('ignores a notification whose data payload is not an object', async () => {
    await SecureStore.setItemAsync('management_token', 'manager-bearer');
    await expect(openManagementNotification(notificationResponse(null as never))).resolves.toBe(
      false
    );
  });

  it('does not register or opt out on an unsupported platform', async () => {
    await withPlatform('web', async () => {
      await SecureStore.setItemAsync('management_token', 'manager-bearer');
      await expect(registerManagementPushToken()).resolves.toBeNull();
      await unregisterManagementPushToken();
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  it('skips the opt-out call when no organizer session is stored', async () => {
    await unregisterManagementPushToken();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('returns false when there is no initial notification to open', async () => {
    mockedNotifications.getLastNotificationResponseAsync.mockResolvedValueOnce(null);
    await expect(openInitialManagementNotification()).resolves.toBe(false);
  });

  it('does not register without an EAS project id', async () => {
    const eas = (Constants as unknown as { expoConfig: { extra: { eas: { projectId?: string } } } })
      .expoConfig.extra.eas;
    const original = eas.projectId;
    eas.projectId = undefined;
    await SecureStore.setItemAsync('management_token', 'manager-bearer');

    await expect(registerManagementPushToken()).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();

    eas.projectId = original;
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
