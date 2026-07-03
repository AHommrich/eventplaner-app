/**
 * Settings tab — currently just user info, language switcher and logout.
 *
 * This screen is intentionally tiny; it exists as the single "app-wide
 * preferences" surface and will host new rows for privacy notice, consents
 * and data-subject rights in future phases (see docs/REFACTOR_PLAN.md).
 * All existing rows below use the same card + row pattern documented in
 * CLAUDE.md so future additions can copy-paste consistently.
 */
import { useEffect, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSession, clearSession, GuestSession } from '../../lib/auth';
import { useLanguage, Language } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';
import { requestErasure } from '../../lib/guest';
import { saveErasureState } from '../../lib/erasure';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<GuestSession | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  /**
   * Clear the local session AND fire the server-side logout (best effort in
   * `clearSession`). The redirect to `/` re-runs the welcome screen's
   * session probe so a logged-out state is picked up immediately.
   */
  async function handleLogout() {
    await clearSession();
    router.replace('/');
  }

  /**
   * Art. 17 GDPR erasure entry point — double-confirmed via `Alert.alert`
   * (same pattern as RSVP decline). On confirm we persist the recovery
   * token BEFORE any session clearing so the pending screen can still read
   * it once the sanctum bearer has been revoked backend-side. Local session
   * is wiped via `SecureStore.deleteItemAsync` directly (not `clearSession`)
   * because the backend has already revoked our token — calling
   * `/api/auth/logout` would 401.
   */
  function askDeleteAccount() {
    Alert.alert(
      t('erasure.confirmTitle'),
      t('erasure.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('erasure.confirmButton'),
          style: 'destructive',
          onPress: performDeleteAccount,
        },
      ],
    );
  }

  async function performDeleteAccount() {
    try {
      const res = await requestErasure();
      await saveErasureState({
        recoveryToken: res.recovery_token,
        scheduledAt: res.scheduled_erasure_at,
        canRevokeUntil: res.can_revoke_until,
      });
      // Local session wipe — backend already revoked the bearer.
      const SecureStore = await import('expo-secure-store');
      await SecureStore.deleteItemAsync('guest_token');
      await SecureStore.deleteItemAsync('guest_id');
      await SecureStore.deleteItemAsync('guest_firstname');
      await SecureStore.deleteItemAsync('guest_lastname');
      await SecureStore.deleteItemAsync('guest_type');
      await SecureStore.deleteItemAsync('guest_family_name');
      router.replace('/erasure-pending');
    } catch (e: any) {
      const message =
        e?.response?.status === 409
          ? t('erasure.alreadyPending')
          : t('erasure.errorMessage');
      Alert.alert(t('erasure.errorTitle'), message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, padding: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md }}>
      {/* Single card: user identity + language + logout, one section each. */}
      <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', overflow: 'hidden', marginBottom: theme.spacing.xl }}>
        {session && (
          <View style={{ padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}>
            <ThemedText style={{ fontSize: 12, color: colors.cardText + 'aa', marginBottom: 4 }}>{t('settings.loggedInAs')}</ThemedText>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.cardText }}>
              {session.firstname} {session.lastname}
            </ThemedText>
            {session.familyName && (
              <ThemedText style={{ fontSize: 14, color: colors.cardText + 'aa', marginTop: 2 }}>
                {session.familyName}
              </ThemedText>
            )}
          </View>
        )}

        {/* Language switcher — persisted in SecureStore, effective immediately. */}
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

        {/* Logout — clears SecureStore + fires server logout best-effort. */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ margin: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.md, alignItems: 'center', backgroundColor: colors.cardButton }}
        >
          <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600', fontSize: 14 }}>{t('settings.logout')}</ThemedText>
        </TouchableOpacity>

        {/* Privacy notice — additive row appended at the bottom of the card
            per Phase 5 of the refactor plan. Every existing row above stays
            byte-identical to before. */}
        <TouchableOpacity
          onPress={() => router.push('/legal/privacy')}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border + '30',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ThemedText style={{ color: colors.cardText, fontSize: 15 }}>
            {t('settings.privacy')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={colors.cardText + 'aa'} />
        </TouchableOpacity>

        {/* Consent management — additive row appended per Phase 6 of the
            refactor plan. Sits directly under the privacy row so the two
            DSGVO-related entries stay grouped. */}
        <TouchableOpacity
          onPress={() => router.push('/consents')}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border + '30',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ThemedText style={{ color: colors.cardText, fontSize: 15 }}>
            {t('settings.consents')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={colors.cardText + 'aa'} />
        </TouchableOpacity>

        {/* Art. 15 GDPR — data export. Additive row per Phase 7. Sits
            below the consents row so the DSGVO block stays grouped. */}
        <TouchableOpacity
          onPress={() => router.push('/data-export')}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border + '30',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ThemedText style={{ color: colors.cardText, fontSize: 15 }}>
            {t('settings.exportData')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={colors.cardText + 'aa'} />
        </TouchableOpacity>

        {/* Art. 17 GDPR — account erasure. Additive row per Phase 7. Uses
            the semantic error colour so the destructive nature is visually
            obvious without a separate design pass. */}
        <TouchableOpacity
          onPress={askDeleteAccount}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border + '30',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ThemedText style={{ color: theme.colors.error, fontSize: 15, fontWeight: '500' }}>
            {t('settings.deleteAccount')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.error + 'aa'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
