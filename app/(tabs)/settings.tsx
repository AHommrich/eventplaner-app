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
import { GenericAppSettingsRows } from '../../components/GenericAppSettingsRows';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSession, clearSession, GuestSession } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';
import { cardSurfaceStyle } from '../../lib/variantStyles';
import { ScreenGradient } from '../../components/ScreenGradient';
import { requestErasure } from '../../lib/guest';
import { saveErasureState } from '../../lib/erasure';
import { captureSentryTestError } from '../../lib/monitoring';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const isSoft = variant.key === 'soft-luxury';
  const softListCard = isSoft
    ? cardSurfaceStyle(variant, colors.card, colors.border, { padded: false })
    : null;
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<GuestSession | null>(null);
  const showSentryTestButton = process.env.EXPO_PUBLIC_ENABLE_SENTRY_TEST_BUTTON === '1';

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
    Alert.alert(t('erasure.confirmTitle'), t('erasure.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('erasure.confirmButton'),
        style: 'destructive',
        onPress: performDeleteAccount,
      },
    ]);
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
        e?.response?.status === 409 ? t('erasure.alreadyPending') : t('erasure.errorMessage');
      Alert.alert(t('erasure.errorTitle'), message);
    }
  }

  async function handleSentryTestError() {
    const sent = await captureSentryTestError();
    Alert.alert(
      t('settings.sentryTestTitle'),
      sent ? t('settings.sentryTestSent') : t('settings.sentryTestUnavailable')
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.screenBg,
        padding: theme.spacing.lg,
        paddingTop: insets.top + theme.spacing.md,
      }}
    >
      {isSoft && <ScreenGradient screenBg={colors.screenBg} primary={colors.primary} />}
      {/* Single card: user identity + language + logout, one section each. */}
      <View
        style={[
          {
            backgroundColor: colors.card,
            borderRadius: theme.borderRadius.lg,
            borderWidth: 2,
            borderColor: colors.border + '33',
            overflow: 'hidden',
            marginBottom: theme.spacing.xl,
          },
          softListCard,
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
              {session.firstname} {session.lastname}
            </ThemedText>
            {session.familyName && (
              <ThemedText style={{ fontSize: 14, color: colors.cardText + 'aa', marginTop: 2 }}>
                {session.familyName}
              </ThemedText>
            )}
          </View>
        )}

        <GenericAppSettingsRows onLogout={handleLogout} />

        {/* Consent management — sits directly under the privacy row so the
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

        <TouchableOpacity
          onPress={() => router.push('/hidden-guests')}
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
            {t('settings.hiddenGuests')}
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

        {showSentryTestButton && (
          <TouchableOpacity
            onPress={handleSentryTestError}
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
              {t('settings.sentryTest')}
            </ThemedText>
            <Ionicons name="bug-outline" size={16} color={colors.cardText + 'aa'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
