import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getSession, GuestSession } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';

export default function HomeScreen() {
  const { t } = useLanguage();
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-3xl font-bold text-primary text-center mb-2">
        {t('home.welcome', { name: session?.firstname ?? '' })}
      </Text>
      <Text className="text-base text-muted text-center">
        {t('home.loggedIn')}
      </Text>

      {/* Placeholder für zukünftige Features */}
    </View>
  );
}
