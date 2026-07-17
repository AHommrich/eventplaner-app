import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GenericAppSettingsRows } from '../../components/GenericAppSettingsRows';
import { ScreenGradient } from '../../components/ScreenGradient';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import {
  clearManagementSession,
  getManagementSession,
  ManagementSession,
} from '../../lib/management';
import { cardSurfaceStyle } from '../../lib/variantStyles';

export default function OrganizerSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, variant, loadTheme } = useEventTheme();
  const [session, setSession] = useState<ManagementSession | null>(null);
  const isSoft = variant.key === 'soft-luxury';

  useEffect(() => {
    getManagementSession().then(setSession);
  }, []);

  async function logout() {
    await clearManagementSession();
    await loadTheme();
    router.replace('/');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.screenBg }}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingTop: insets.top + theme.spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
    >
      {isSoft && <ScreenGradient screenBg={colors.screenBg} primary={colors.primary} />}
      <View
        style={[
          {
            backgroundColor: colors.card,
            borderRadius: theme.borderRadius.lg,
            borderWidth: 2,
            borderColor: colors.border + '33',
            overflow: 'hidden',
          },
          isSoft ? cardSurfaceStyle(variant, colors.card, colors.border, { padded: false }) : null,
        ]}
      >
        {session && (
          <View
            style={{
              padding: theme.spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border + '30',
            }}
          >
            <ThemedText style={{ fontSize: 12, color: colors.cardText + 'aa', marginBottom: 4 }}>
              {t('settings.loggedInAs')}
            </ThemedText>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.cardText }}>
              {session.name}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, color: colors.cardText + 'aa', marginTop: 2 }}>
              {session.email}
            </ThemedText>
          </View>
        )}
        <GenericAppSettingsRows onLogout={logout} />
      </View>
    </ScrollView>
  );
}
