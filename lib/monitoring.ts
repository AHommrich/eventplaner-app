/**
 * Sentry error monitoring bootstrap.
 *
 * Sentry's React Native SDK is a native module and is therefore meant for
 * development builds / EAS builds, not Expo Go. Keeping the SDK load deferred lets
 * Expo Go keep working while production builds get crash reporting as soon as a
 * public DSN is supplied through EXPO_PUBLIC_SENTRY_DSN.
 */
import Constants from 'expo-constants';

let initialized = false;

function getSentryDsn(): string {
  return process.env['EXPO_PUBLIC_SENTRY_DSN'] ?? '';
}

function getSentryTracesSampleRate(): number {
  return Number(process.env['EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE'] ?? '0');
}

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

function loadSentry(): typeof import('@sentry/react-native') {
  return require('@sentry/react-native');
}

export async function initMonitoring(): Promise<void> {
  const dsn = getSentryDsn();
  if (initialized || !dsn || isExpoGo()) return;
  initialized = true;

  try {
    const Sentry = loadSentry();
    const tracesSampleRate = getSentryTracesSampleRate();
    Sentry.init({
      dsn,
      enabled: true,
      sendDefaultPii: false,
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
      beforeSend: sanitizeEvent,
    });
  } catch {
    initialized = false;
  }
}

export function captureException(error: unknown): void {
  if (!getSentryDsn() || isExpoGo() || !initialized) return;
  try {
    const Sentry = loadSentry();
    Sentry.captureException(error);
  } catch {
    // SDK nicht verfügbar — still ignorieren
  }
}

export async function captureSentryTestError(): Promise<boolean> {
  if (!getSentryDsn() || isExpoGo()) return false;
  await initMonitoring();
  if (!initialized) return false;

  const Sentry = loadSentry();
  Sentry.captureException(new Error('eveplan Sentry test error'));
  return true;
}
