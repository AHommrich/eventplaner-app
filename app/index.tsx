import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession } from '../lib/auth';

export default function WelcomeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        router.replace('/(tabs)/home');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) return <View className="flex-1 bg-background" />;

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-4xl font-bold text-primary text-center mb-3">
        André & Tabea
      </Text>
      <Text className="text-base text-muted text-center mb-16">
        Willkommen zu unserer Hochzeit
      </Text>
      <TouchableOpacity
        className="bg-primary w-full py-4 rounded-lg items-center"
        onPress={() => router.push('/scan')}
      >
        <Text className="text-white text-base font-semibold">
          QR-Code scannen
        </Text>
      </TouchableOpacity>
    </View>
  );
}
