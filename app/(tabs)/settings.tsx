import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, clearSession, GuestSession } from '../../lib/auth';
import { useLanguage, Language } from '../../lib/LanguageContext';
import { theme } from '../../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
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
          <Text className="text-xs text-muted mb-1">{t('settings.loggedInAs')}</Text>
          <Text className="text-base font-semibold text-primary">
            {session.firstname} {session.lastname}
          </Text>
          {session.familyName && (
            <Text className="text-sm text-muted mt-0.5">
              {t('settings.family', { name: session.familyName })}
            </Text>
          )}
        </View>
      )}

      {/* Language switcher */}
      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="text-xs text-muted mb-3">{t('settings.language')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['de', 'en'] as Language[]).map((lang) => (
            <TouchableOpacity
              key={lang}
              onPress={() => setLanguage(lang)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: language === lang ? theme.colors.primary : theme.colors.background,
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: language === lang ? theme.colors.secondary : theme.colors.muted,
                }}
              >
                {lang === 'de' ? t('settings.german') : t('settings.english')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        className="border border-error py-4 rounded-xl items-center"
        onPress={handleLogout}
      >
        <Text className="text-error font-semibold">{t('settings.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}
