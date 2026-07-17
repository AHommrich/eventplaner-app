import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import api from './api';
import { getActiveManagementEventId, retryPendingManagementLogout } from './management';

const PUSH_TOKEN_KEY = 'management_expo_push_token';
const PUSH_ENABLED_KEY = 'management_push_enabled';
const ANDROID_CHANNEL = 'organizer-tasks';

type AssignedNoteData = {
  type: 'assigned_note';
  event_id: number;
  note_id: number;
};

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function assignedNoteData(value: unknown): AssignedNoteData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const eventId = Number(data.event_id);
  const noteId = Number(data.note_id);

  if (data.type !== 'assigned_note' || !Number.isInteger(eventId) || !Number.isInteger(noteId)) {
    return null;
  }

  return { type: 'assigned_note', event_id: eventId, note_id: noteId };
}

export async function registerManagementPushToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (!(await SecureStore.getItemAsync('management_token'))) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Organizer tasks',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return null;

  const easProjectId = projectId();
  if (!easProjectId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
  await api.post('/api/management/push/register', {
    expo_token: token,
    platform: Platform.OS,
  });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  return token;
}

export async function unregisterManagementPushToken(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!(await SecureStore.getItemAsync('management_token'))) return;

  await api.post('/api/management/push/register', {
    enabled: false,
  });
}

export async function getManagementPushEnabled(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PUSH_ENABLED_KEY);
  if (stored !== null) return stored === 'true';

  // Preserve an existing user's previous opt-in when upgrading from the
  // auto-registration build. Fresh installs have no token and default off.
  return (await SecureStore.getItemAsync(PUSH_TOKEN_KEY)) !== null;
}

export async function setManagementPushEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    await unregisterManagementPushToken();
    await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'false');
    return false;
  }

  const token = await registerManagementPushToken();
  if (!token) {
    await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'false');
    return false;
  }

  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'true');
  return true;
}

export async function syncManagementPushPreference(): Promise<boolean> {
  if (!(await getManagementPushEnabled())) return false;
  if (!(await SecureStore.getItemAsync('management_token'))) return true;

  const token = await registerManagementPushToken();
  if (token) return true;

  // Permission was revoked or native push is unavailable. Remove any stale
  // server destination instead of displaying a misleading enabled state.
  await unregisterManagementPushToken();
  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'false');
  return false;
}

export async function openManagementNotification(
  response: Notifications.NotificationResponse
): Promise<boolean> {
  const data = assignedNoteData(response.notification.request.content.data);
  if (!data || !(await SecureStore.getItemAsync('management_token'))) return false;
  if ((await getActiveManagementEventId()) !== data.event_id) return false;

  router.push({
    pathname: '/organizer/notes',
    params: { noteId: String(data.note_id) },
  });
  return true;
}

export async function openInitialManagementNotification(): Promise<boolean> {
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (!lastResponse || !(await openManagementNotification(lastResponse))) return false;

  await Notifications.clearLastNotificationResponseAsync();
  return true;
}

async function registerRotatedPushToken(): Promise<void> {
  const easProjectId = projectId();
  if (!easProjectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;

  // Installation state must follow rotation even while delivery is disabled,
  // otherwise a later opt-in would re-register the obsolete token.
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  if (!(await getManagementPushEnabled())) return;
  if (!(await SecureStore.getItemAsync('management_token'))) return;

  await api.post('/api/management/push/register', {
    expo_token: token,
    platform: Platform.OS,
  });
}

export function initializeManagementPushNotifications(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void openManagementNotification(response);
  });
  const tokenSubscription = Notifications.addPushTokenListener(() => {
    void registerRotatedPushToken().catch(() => {
      // Keep the previous token; a later registration attempt will reconcile it.
    });
  });

  void (async () => {
    await retryPendingManagementLogout();

    try {
      await syncManagementPushPreference();
    } catch {
      // Token acquisition/registration is best effort and retries on the next app launch.
    }
  })();

  return () => {
    responseSubscription.remove();
    tokenSubscription.remove();
  };
}
