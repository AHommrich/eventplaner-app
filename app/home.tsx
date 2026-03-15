import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, clearSession, GuestSession } from '../lib/auth';
import { theme } from '../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  async function handleLogout() {
    await clearSession();
    router.replace('/');
  }

  const greeting = session?.firstname ?? '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Willkommen, {greeting}!</Text>
      <Text style={styles.subtitle}>Du bist eingeloggt.</Text>

      {/* Placeholder für zukünftige Features */}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Ausloggen</Text>
      </TouchableOpacity>
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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm + 4,
    borderRadius: theme.borderRadius.md,
  },
  logoutText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
