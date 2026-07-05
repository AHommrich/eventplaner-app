/**
 * Onboarding RSVP — shown once, right after first login, before the guest is
 * routed into the tab layout.
 *
 * Distinct from `app/(tabs)/rsvp.tsx` in scope: this screen exists for the
 * very first "yes / no" answer and offers only the own-RSVP decision plus a
 * "Continue" button that moves the guest into `/(tabs)/home` once they have
 * accepted. Group-member RSVPs happen later in the tab-RSVP screen.
 *
 * Accept flow: `handleOwnRsvp(true)` → posts to `/api/guest/rsvp`, the
 * backend returns `accepted_pending`, `handleContinue` routes to home.
 *
 * Decline flow: double-confirm via `Alert` (same pattern as the tab-RSVP
 * screen), then `handleOwnRsvp(false)` → posts declined → hard-redirect to
 * `/declined`. The onboarding screen never leaves the guest here in a
 * decided state.
 */
import { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { useRouter } from 'expo-router';
import { useLanguage } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';
import {
  fetchGuestMe,
  fetchEventInfo,
  postRsvp,
  GuestMe,
} from '../lib/guest';
import { theme } from '../constants/theme';

/** Locale-aware deadline formatter — `de-DE` for German, `en-GB` for English. */
function formatDeadline(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function RsvpScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors } = useEventTheme();

  const [guest, setGuest] = useState<GuestMe | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOwn, setSavingOwn] = useState(false);

  useEffect(() => {
    Promise.all([fetchGuestMe(), fetchEventInfo()])
      .then(([g, info]) => {
        setGuest(g);
        setDeadline(info.rsvp_deadline);
      })
      .catch(() => Alert.alert(t('common.error')))
      .finally(() => setLoading(false));
    // Bootstrap load — the onboarding RSVP screen only fetches once. If the
    // language switches mid-render, the error alert copy simply lags behind
    // by one action; that's acceptable versus re-fetching on every t change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Double-confirm dialog — decline is destructive, we surface that explicitly. */
  function confirmDecline() {
    Alert.alert(
      t('rsvp.declineConfirmTitle'),
      t('rsvp.declineConfirmOwn'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('rsvp.declineConfirmButton'), style: 'destructive', onPress: () => handleOwnRsvp(false) },
      ],
    );
  }

  async function handleOwnRsvp(attending: boolean) {
    if (!guest) return;
    setSavingOwn(true);
    try {
      const newStatus = await postRsvp(attending);
      const updated = { ...guest, rsvp_status: newStatus };
      setGuest(updated);
      if (!attending) {
        // Onboarding decline: leave immediately — the declined screen owns
        // the revocation-request UX, this screen doesn't.
        router.replace('/declined');
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.unknownError'));
    } finally {
      setSavingOwn(false);
    }
  }

  function handleContinue() {
    router.replace('/(tabs)/home');
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screenBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!guest) return null;

  const ownStatus = guest.rsvp_status;
  const ownAccepted = ownStatus === 'accepted_pending' || ownStatus === 'accepted';
  const ownDeclined = ownStatus === 'declined_pending' || ownStatus === 'declined';
  // Once a decision exists, both buttons visibly lock (the disabled one goes
  // to 0.4 opacity, matching the button-disable pattern in CLAUDE.md).
  const ownSet = ownStatus !== null;
  const deadlineFormatted = deadline ? formatDeadline(deadline, language) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.screenBg }}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 48 }}
    >
      <ThemedText
        style={{
          fontSize: 28,
          fontWeight: 'bold',
          color: colors.primary,
          marginBottom: theme.spacing.sm,
          marginTop: theme.spacing.xl,
        }}
      >
        {t('rsvp.title')}
      </ThemedText>
      {deadlineFormatted && (
        <ThemedText style={{ fontSize: 14, color: theme.colors.muted, marginBottom: theme.spacing.xl }}>
          {t('rsvp.subtitle', { deadline: deadlineFormatted })}
        </ThemedText>
      )}

      {/* Own RSVP — the only decision presented on the onboarding screen. */}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
        }}
      >
        <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.primary, marginBottom: theme.spacing.md }}>
          {guest.firstname} {guest.lastname}
        </ThemedText>
        {savingOwn ? (
          <ActivityIndicator color={theme.colors.primary} style={{ alignSelf: 'flex-start' }} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => !ownSet && handleOwnRsvp(true)}
              disabled={ownSet}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: ownAccepted ? theme.colors.sage : theme.colors.surface,
                borderWidth: 1,
                borderColor: ownAccepted ? theme.colors.sage : theme.colors.muted,
                opacity: ownSet && !ownAccepted ? 0.4 : 1,
              }}
            >
              <ThemedText style={{ fontWeight: '700', color: ownAccepted ? '#fff' : theme.colors.muted }}>
                {t('rsvp.accept')}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => !ownSet && confirmDecline()}
              disabled={ownSet}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: theme.colors.error,
                borderWidth: 1,
                borderColor: theme.colors.error,
                opacity: ownSet && !ownDeclined ? 0.4 : 1,
              }}
            >
              <ThemedText style={{ fontWeight: '700', color: '#fff' }}>
                {t('rsvp.decline')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Continue — only appears once the guest has accepted. */}
      {ownAccepted && (
        <TouchableOpacity
          onPress={handleContinue}
          style={{
            backgroundColor: colors.primary,
            borderRadius: theme.borderRadius.md,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
            marginTop: theme.spacing.sm,
          }}
        >
          <ThemedText style={{ color: theme.colors.secondary, fontWeight: '700', fontSize: 16 }}>
            {t('scan.continue')}
          </ThemedText>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
