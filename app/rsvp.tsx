import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
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
  }, []);

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
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!guest) return null;

  const ownStatus = guest.rsvp_status;
  const ownAccepted = ownStatus === 'accepted_pending' || ownStatus === 'accepted';
  const ownDeclined = ownStatus === 'declined_pending' || ownStatus === 'declined';
  const ownSet = ownStatus !== null;
  const deadlineFormatted = deadline ? formatDeadline(deadline, language) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 48 }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: 'bold',
          color: colors.accent,
          marginBottom: theme.spacing.sm,
          marginTop: theme.spacing.xl,
        }}
      >
        {t('rsvp.title')}
      </Text>
      {deadlineFormatted && (
        <Text style={{ fontSize: 14, color: theme.colors.muted, marginBottom: theme.spacing.xl }}>
          {t('rsvp.subtitle', { deadline: deadlineFormatted })}
        </Text>
      )}

      {/* Eigene RSVP */}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent, marginBottom: theme.spacing.md }}>
          {guest.firstname} {guest.lastname}
        </Text>
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
              <Text style={{ fontWeight: '700', color: ownAccepted ? '#fff' : theme.colors.muted }}>
                {t('rsvp.accept')}
              </Text>
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
              <Text style={{ fontWeight: '700', color: '#fff' }}>
                {t('rsvp.decline')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Weiter-Button — sobald eigene Zusage gesetzt */}
      {ownAccepted && (
        <TouchableOpacity
          onPress={handleContinue}
          style={{
            backgroundColor: colors.accent,
            borderRadius: theme.borderRadius.md,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
            marginTop: theme.spacing.sm,
          }}
        >
          <Text style={{ color: theme.colors.secondary, fontWeight: '700', fontSize: 16 }}>
            {t('scan.continue')}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
