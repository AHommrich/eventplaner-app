/**
 * Full-screen "app is temporarily disabled" barrier.
 *
 * Reached from the axios response interceptor in `lib/api.ts` when the
 * backend hands back a 403 with `code: 'app_blocked'`. The couple's admin UI
 * toggles this flag when the app needs to be paused (e.g. mid-ceremony
 * silence, or a data problem the couple wants to fix before guests keep
 * poking).
 *
 * The screen polls `/api/guest/me` every 10 seconds to detect a re-enable.
 * A successful response calls `clearBlocked()` to reset the interceptor's
 * debounce flag and routes the guest back to `/` so `app/index.tsx` picks
 * the appropriate post-login destination.
 */
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { clearBlocked } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { theme } from '../constants/theme';

const POLL_INTERVAL = 10_000;

export default function BlockedScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check() {
    try {
      await api.get('/api/guest/me');
      clearBlocked();
      router.replace('/');
    } catch {
      // Still blocked or network offline — stay put and try again next tick.
    }
  }

  useEffect(() => {
    intervalRef.current = setInterval(check, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Bootstrap poll — the `check` closure captures whatever refs it needs
    // and this effect must run exactly once per mount, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed-outline" size={64} color={theme.colors.muted} />
      <ThemedText style={styles.title}>{t('blocked.title')}</ThemedText>
      <ThemedText style={styles.message}>{t('blocked.message')}</ThemedText>
      <ActivityIndicator color={theme.colors.muted} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
