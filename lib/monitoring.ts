/**
 * Sentry error monitoring bootstrap.
 *
 * Sentry's React Native SDK is a native module and is therefore meant for
 * development builds / EAS builds, not Expo Go. Keeping the import dynamic lets
 * Expo Go keep working while production builds get crash reporting as soon as a
 * public DSN is supplied through EXPO_PUBLIC_SENTRY_DSN.
 */
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const SENTRY_TRACES_SAMPLE_RATE = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0');

let initialized = false;

function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

function sanitizeEvent(event: any) {
  // The app deliberately has no user accounts or email addresses. Do not let
  // future SDK defaults or helper calls turn Sentry into a personal-data sink.
  delete event.user;

  if (event.request?.headers) {
    delete event.request.headers.Authorization;
    delete event.request.headers.authorization;
    delete event.request.headers.Cookie;
    delete event.request.headers.cookie;
  }

  return event;
}

export async function initMonitoring(): Promise<void> {
  if (initialized || !SENTRY_DSN || isExpoGo()) return;
  initialized = true;

  try {
    const Sentry = await import('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: true,
      sendDefaultPii: false,
      tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0,
      beforeSend: sanitizeEvent,
    });
  } catch {
    initialized = false;
  }
}

export async function captureSentryTestError(): Promise<boolean> {
  if (!SENTRY_DSN || isExpoGo()) return false;
  await initMonitoring();
  if (!initialized) return false;

  const Sentry = await import('@sentry/react-native');
  Sentry.captureException(new Error('eveplan Sentry test error'));
  return true;
}
