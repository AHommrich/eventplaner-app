import { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession, clearSession, GuestSession } from '../../lib/auth';
import { useLanguage, Language } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  async function handleLogout() {
    await clearSession();
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, padding: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md }}>
      {/* Eine Card: Nutzer-Info + Sprache */}
      <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', overflow: 'hidden', marginBottom: theme.spacing.xl }}>
        {session && (
          <View style={{ padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}>
            <ThemedText style={{ fontSize: 12, color: colors.cardText + 'aa', marginBottom: 4 }}>{t('settings.loggedInAs')}</ThemedText>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.cardText }}>
              {session.firstname} {session.lastname}
            </ThemedText>
            {session.familyName && (
              <ThemedText style={{ fontSize: 14, color: colors.cardText + 'aa', marginTop: 2 }}>
                {t('settings.family', { name: session.familyName })}
              </ThemedText>
            )}
          </View>
        )}

        {/* Language switcher */}
        <View style={{ padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}>
          <ThemedText style={{ fontSize: 12, color: colors.cardText + 'aa', marginBottom: theme.spacing.sm }}>{t('settings.language')}</ThemedText>
          <View style={{ flexDirection: 'row', borderRadius: theme.borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border + '55' }}>
            {(['de', 'en'] as Language[]).map((lang, i) => (
              <TouchableOpacity
                key={lang}
                onPress={() => setLanguage(lang)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: language === lang ? colors.cardButton : 'transparent',
                  borderRightWidth: i === 0 ? 1 : 0,
                  borderRightColor: colors.border + '55',
                }}
              >
                <ThemedText style={{ fontWeight: '600', color: language === lang ? colors.cardButtonText : colors.cardText }}>
                  {lang === 'de' ? t('settings.german') : t('settings.english')}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ margin: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.md, alignItems: 'center', backgroundColor: colors.cardButton }}
        >
          <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600', fontSize: 14 }}>{t('settings.logout')}</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}
