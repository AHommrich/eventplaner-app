import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, clearSession, GuestSession } from '../../lib/auth';

export default function SettingsScreen() {
  const router = useRouter();
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  async function handleLogout() {
    await clearSession();
    router.replace('/');
  }

  return (
    <View className="flex-1 bg-background p-6 justify-center">
      {session && (
        <View className="bg-white rounded-xl p-4 mb-8">
          <Text className="text-xs text-muted mb-1">Eingeloggt als</Text>
          <Text className="text-base font-semibold text-primary">
            {session.firstname} {session.lastname}
          </Text>
          {session.familyName && (
            <Text className="text-sm text-muted mt-0.5">
              Familie {session.familyName}
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity
        className="border border-error py-4 rounded-xl items-center"
        onPress={handleLogout}
      >
        <Text className="text-error font-semibold">Ausloggen</Text>
      </TouchableOpacity>
    </View>
  );
}
