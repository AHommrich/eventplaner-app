import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession } from '../lib/auth';
import { theme } from '../constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        router.replace('/home');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>André & Tabea</Text>
      <Text style={styles.subtitle}>Willkommen zu unserer Hochzeit</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/scan')}>
        <Text style={styles.buttonText}>QR-Code scannen</Text>
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
    fontSize: 36,
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
  button: {
    backgroundColor: theme.colors.primary,
    width: '100%',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
