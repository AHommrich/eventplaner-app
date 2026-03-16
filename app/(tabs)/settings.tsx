import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, clearSession, GuestSession } from '../../lib/auth';
import { useLanguage, Language } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { colors } = useEventTheme();
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  async function handleLogout() {
    await clearSession();
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: theme.spacing.lg, justifyContent: 'center' }}>
      {session && (
        <View style={{ backgroundColor: '#fff', borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.xl }}>
          <Text style={{ fontSize: 12, color: theme.colors.muted, marginBottom: 4 }}>{t('settings.loggedInAs')}</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>
            {session.firstname} {session.lastname}
          </Text>
          {session.familyName && (
            <Text style={{ fontSize: 14, color: theme.colors.muted, marginTop: 2 }}>
              {t('settings.family', { name: session.familyName })}
            </Text>
          )}
        </View>
      )}

      {/* Language switcher */}
      <View style={{ backgroundColor: '#fff', borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <Text style={{ fontSize: 12, color: theme.colors.muted, marginBottom: theme.spacing.sm }}>{t('settings.language')}</Text>
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
                backgroundColor: language === lang ? colors.primary : colors.background,
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: language === lang ? '#fff' : theme.colors.muted,
                }}
              >
                {lang === 'de' ? t('settings.german') : t('settings.english')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        style={{ borderWidth: 1, borderColor: theme.colors.error, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg, alignItems: 'center' }}
      >
        <Text style={{ color: theme.colors.error, fontWeight: '600' }}>{t('settings.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}
