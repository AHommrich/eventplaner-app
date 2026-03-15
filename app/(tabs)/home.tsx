import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getSession, GuestSession } from '../../lib/auth';

export default function HomeScreen() {
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-3xl font-bold text-primary text-center mb-2">
        Willkommen, {session?.firstname ?? ''}!
      </Text>
      <Text className="text-base text-muted text-center">
        Du bist eingeloggt.
      </Text>

      {/* Placeholder für zukünftige Features */}
    </View>
  );
}
