/**
 * Post-decline landing screen with revocation-request flow.
 *
 * States (drive title, subtitle, and which action button appears):
 *   - `declined_pending` .. the guest just declined; can still request a
 *                            revocation of the decline via the button.
 *   - `declined` .......... final; the couple has confirmed the decline.
 *                            No revocation button, only logout.
 *   - `revocation_requested` .. waiting for couple-side approval;
 *                            no button changes state until the couple flips
 *                            it back to `accepted_pending`, at which point
 *                            the polling below routes the guest onwards.
 *
 * A 30-second poll of `/api/guest/me` catches any state change the couple
 * makes in the admin backend so a re-invited guest lands on the correct
 * screen without needing to reopen the app.
 */
import { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { isHandledApiError } from '../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';
import { clearSession } from '../lib/auth';
import { useQuery } from '@tanstack/react-query';
import { fetchGuestMe, postRevoke, GuestMe, RsvpStatus, isFullAccess } from '../lib/guest';
import { queryClient } from '../lib/queryClient';
import { qk } from '../lib/queryKeys';
import { useSessionScope } from '../lib/SessionContext';
import { theme } from '../constants/theme';

/** Poll interval — matches the "check every 30 s" pattern of the photos tab. */
const POLL_INTERVAL = 30_000;

function formatDeadline(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function DeclinedScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors, eventInfo } = useEventTheme();
  const scope = useSessionScope();
  // Read insets up here — every hook must run on every render to satisfy
  // React's rules-of-hooks. The early `if (loading) return …` further down
  // used to sit above this call and produced a "conditional hook" warning.
  const insets = useSafeAreaInsets();

  const [revoking, setRevoking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guest status is a cache-backed query polling every 30 s (CP4); the deadline
  // comes from the shared theme/event query (no second /api/event/info fetch).
  const guestQuery = useQuery(
    {
      queryKey: qk.guestMe(scope),
      queryFn: ({ signal }) => fetchGuestMe(signal),
      enabled: scope !== null,
      refetchInterval: POLL_INTERVAL,
      refetchIntervalInBackground: false,
    },
    queryClient
  );
  const status: RsvpStatus = guestQuery.data?.rsvp_status ?? null;
  const deadline = eventInfo?.rsvp_deadline ?? null;
  const loading = guestQuery.isLoading;

  // Route guards: if the couple moved the guest back into an active-RSVP state,
  // bounce out of the declined screen so it never gets "stuck".
  useEffect(() => {
    if (!guestQuery.data) return;
    const s = guestQuery.data.rsvp_status;
    if (s === null) router.replace('/rsvp');
    else if (isFullAccess(s)) router.replace('/(tabs)/home');
  }, [guestQuery.data, router]);

  async function handleRefresh() {
    setRefreshing(true);
    await guestQuery.refetch();
    setRefreshing(false);
    setRefreshed(true);
    if (refreshedTimer.current) clearTimeout(refreshedTimer.current);
    refreshedTimer.current = setTimeout(() => setRefreshed(false), 2000);
  }

  useEffect(() => {
    return () => {
      if (refreshedTimer.current) clearTimeout(refreshedTimer.current);
    };
  }, []);

  /**
   * Ask the couple to reverse the decline. Moves the guest into the
   * `revocation_requested` state; the poll above catches the couple's
   * decision when it lands.
   */
  async function handleRevoke() {
    setRevoking(true);
    try {
      const newStatus = await postRevoke();
      queryClient.setQueryData<GuestMe>(qk.guestMe(scope), (prev) =>
        prev ? { ...prev, rsvp_status: newStatus } : prev
      );
    } catch (e: any) {
      if (isHandledApiError(e)) return;
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.unknownError'));
    } finally {
      setRevoking(false);
    }
  }

  async function handleLogout() {
    await clearSession();
    router.replace('/');
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.screenBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const isFinal = status === 'declined';
  const isPending = status === 'declined_pending';
  const isRevocationRequested = status === 'revocation_requested';
  const deadlineFormatted = deadline ? formatDeadline(deadline, language) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.lg, justifyContent: 'center' }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
          <Ionicons
            name="close-circle-outline"
            size={64}
            color={isFinal ? theme.colors.muted : theme.colors.error}
          />
        </View>

        <ThemedText
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: colors.primary,
            textAlign: 'center',
            marginBottom: theme.spacing.md,
          }}
        >
          {isFinal ? t('declined.titleFinal') : t('declined.titlePending')}
        </ThemedText>

        {deadlineFormatted && (
          <ThemedText
            style={{
              fontSize: 14,
              color: theme.colors.muted,
              textAlign: 'center',
              marginBottom: theme.spacing.sm,
            }}
          >
            {t('declined.deadline', { date: deadlineFormatted })}
          </ThemedText>
        )}

        <ThemedText
          style={{
            fontSize: 15,
            color: theme.colors.muted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: theme.spacing.xl,
          }}
        >
          {isRevocationRequested
            ? t('declined.revocationPending')
            : isFinal
              ? t('declined.subtitleFinal')
              : t('declined.subtitlePending')}
        </ThemedText>

        {/* Request revocation — only reachable from `declined_pending`. */}
        {isPending && (
          <TouchableOpacity
            onPress={handleRevoke}
            disabled={revoking}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: theme.borderRadius.md,
              paddingVertical: theme.spacing.md,
              alignItems: 'center',
              marginBottom: theme.spacing.md,
            }}
          >
            {revoking ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>
                {t('declined.revokeButton')}
              </ThemedText>
            )}
          </TouchableOpacity>
        )}

        {/* Logout — always available from this screen. */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.error,
            borderRadius: theme.borderRadius.md,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
          }}
        >
          <ThemedText style={{ color: theme.colors.error, fontWeight: '600' }}>
            {t('declined.logout')}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Pull-to-refresh toast — absolute-positioned centred pill. */}
      {refreshed && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 12,
            alignSelf: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: theme.borderRadius.full,
          }}
        >
          <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            ✓ {t('common.refreshed')}
          </ThemedText>
        </View>
      )}
    </View>
  );
}
