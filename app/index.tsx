import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-4xl font-bold text-primary text-center mb-4">
        André & Tabea
      </Text>
      <Text className="text-base text-muted text-center mb-16">
        Willkommen zu unserer Hochzeit
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/scan')}
        className="bg-primary w-full py-4 rounded-lg items-center"
      >
        <Text className="text-secondary text-base font-semibold">
          QR-Code scannen
        </Text>
      </TouchableOpacity>
    </View>
  );
}
