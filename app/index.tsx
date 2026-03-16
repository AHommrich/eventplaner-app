import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession } from '../lib/auth';
import { fetchGuestMe, isFullAccess, isDeclinedFlow } from '../lib/guest';
import { useLanguage } from '../lib/LanguageContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session) {
        setChecking(false);
        return;
      }
      try {
        const guest = await fetchGuestMe();
        if (guest.rsvp_status === null) {
          router.replace('/rsvp');
        } else if (isFullAccess(guest.rsvp_status)) {
          router.replace('/(tabs)/home');
        } else if (isDeclinedFlow(guest.rsvp_status)) {
          router.replace('/declined');
        }
      } catch {
        // API nicht erreichbar — trotzdem zeigen
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
        {t('welcome.subtitle')}
      </Text>
      <TouchableOpacity
        className="bg-primary w-full py-4 rounded-lg items-center"
        onPress={() => router.push('/scan')}
      >
        <Text className="text-white text-base font-semibold">
          {t('welcome.scanButton')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
