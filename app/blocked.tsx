import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
      // noch gesperrt oder Netzwerkfehler — bleiben
    }
  }

  useEffect(() => {
    intervalRef.current = setInterval(check, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed-outline" size={64} color={theme.colors.muted} />
      <Text style={styles.title}>{t('blocked.title')}</Text>
      <Text style={styles.message}>{t('blocked.message')}</Text>
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
