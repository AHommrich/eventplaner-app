import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, clearSession, GuestSession } from '../lib/auth';

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

  const greeting = session?.type === 'family' && session.familyName
    ? `Familie ${session.familyName}`
    : session?.firstname ?? '';

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-3xl font-bold text-primary text-center mb-4">
        Willkommen, {greeting}!
      </Text>
      <Text className="text-base text-muted text-center mb-16">
        Du bist eingeloggt.
      </Text>

      {/* Placeholder für zukünftige Features */}

      <TouchableOpacity
        onPress={handleLogout}
        className="border border-primary px-8 py-3 rounded-lg"
      >
        <Text className="text-primary font-semibold">Ausloggen</Text>
      </TouchableOpacity>
    </View>
  );
}
