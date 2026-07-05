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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';
import { clearSession } from '../lib/auth';
import { fetchGuestMe, fetchEventInfo, postRevoke, RsvpStatus, isFullAccess } from '../lib/guest';
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
  const { colors } = useEventTheme();
  // Read insets up here — every hook must run on every render to satisfy
  // React's rules-of-hooks. The early `if (loading) return …` further down
  // used to sit above this call and produced a "conditional hook" warning.
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<RsvpStatus>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData(isRefresh = false) {
    try {
      const [guest, info] = await Promise.all([fetchGuestMe(), fetchEventInfo()]);
      setStatus(guest.rsvp_status);
      setDeadline(info.rsvp_deadline);
      // Post-load routing: if the couple has meanwhile moved the guest back
      // into an active-RSVP state, bounce out of the declined screen so it
      // never gets "stuck".
      if (guest.rsvp_status === null) {
        router.replace('/rsvp');
        return;
      }
      if (isFullAccess(guest.rsvp_status)) {
        router.replace('/(tabs)/home');
      }
    } catch {
      // Silent — the polling loop tries again in POLL_INTERVAL ms.
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData(true);
    setRefreshed(true);
    if (refreshedTimer.current) clearTimeout(refreshedTimer.current);
    refreshedTimer.current = setTimeout(() => setRefreshed(false), 2000);
  }

  useEffect(() => {
    loadData();
    // Passive poll — same route as the manual pull-to-refresh above, minus
    // the toast/spinner side effects, so the guest doesn't see a spinner
    // every 30 s.
    intervalRef.current = setInterval(async () => {
      try {
        const guest = await fetchGuestMe();
        if (guest.rsvp_status === null) {
          router.replace('/rsvp');
        } else if (isFullAccess(guest.rsvp_status)) {
          router.replace('/(tabs)/home');
        } else {
          setStatus(guest.rsvp_status);
        }
      } catch {
        // silent
      }
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Bootstrap poll — captures `loadData` and `router` once. Re-running on
    // every render would tear down and re-create the interval and could
    // race the 30 s polling clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setStatus(newStatus);
    } catch (e: any) {
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
