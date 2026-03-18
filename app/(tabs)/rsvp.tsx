import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import {
  fetchGuestMe,
  fetchEventInfo,
  postRsvp,
  postGroupRsvp,
  GuestMe,
  GroupMember,
  RsvpStatus,
  isDeclinedFlow,
} from '../../lib/guest';
import { theme } from '../../constants/theme';

function formatDeadline(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function StatusBadge({ status, t }: { status: RsvpStatus; t: (k: string) => string }) {
  const accepted = status === 'accepted_pending' || status === 'accepted';
  const declined = status === 'declined_pending' || status === 'declined';
  if (!status) return null;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: theme.borderRadius.full,
        backgroundColor: accepted
          ? theme.colors.sage
          : declined
          ? theme.colors.error
          : theme.colors.muted,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
        {accepted ? t('rsvp.statusAccepted') : t('rsvp.statusDeclined')}
      </Text>
    </View>
  );
}

export default function RsvpTabScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();

  const [guest, setGuest] = useState<GuestMe | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOwn, setSavingOwn] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<number | null>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadData(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [g, info] = await Promise.all([fetchGuestMe(), fetchEventInfo()]);
      if (isDeclinedFlow(g.rsvp_status)) {
        router.replace('/declined');
        return;
      }
      if (g.rsvp_status === 'accepted') {
        router.replace('/(tabs)/home');
        return;
      }
      setGuest(g);
      setDeadline(info.rsvp_deadline);
      setDeadlinePassed(new Date(info.rsvp_deadline) < new Date());
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? String(e);
      Alert.alert(t('common.error'), `${e?.response?.status ?? ''} ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function handleRefresh() {
    setRefreshing(true);
    await loadData(true);
    setRefreshed(true);
    if (refreshedTimer.current) clearTimeout(refreshedTimer.current);
    refreshedTimer.current = setTimeout(() => setRefreshed(false), 2000);
  }

  function confirmDecline(onConfirm: () => void, memberName?: string) {
    Alert.alert(
      t('rsvp.declineConfirmTitle'),
      memberName
        ? t('rsvp.declineConfirmMember', { name: memberName })
        : t('rsvp.declineConfirmOwn'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('rsvp.declineConfirmButton'), style: 'destructive', onPress: onConfirm },
      ],
    );
  }

  async function handleOwnRsvp(attending: boolean) {
    if (!guest || deadlinePassed) return;
    setSavingOwn(true);
    try {
      const newStatus = await postRsvp(attending);
      if (isDeclinedFlow(newStatus)) {
        router.replace('/declined');
        return;
      }
      setGuest((prev) => prev ? { ...prev, rsvp_status: newStatus } : prev);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.unknownError'));
    } finally {
      setSavingOwn(false);
    }
  }

  async function handleGroupRsvp(guestId: number, attending: boolean) {
    if (!guest || deadlinePassed) return;
    setSavingMemberId(guestId);
    try {
      const res = await postGroupRsvp(guestId, attending);
      setGuest((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          group_members: prev.group_members.map((m) =>
            m.guest_id === guestId
              ? {
                  ...m,
                  rsvp_status: res.rsvp_status,
                  rsvp_set_by: {
                    guest_id: prev.guest_id,
                    firstname: prev.firstname,
                    lastname: prev.lastname,
                  },
                }
              : m,
          ),
        };
      });
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.unknownError'));
    } finally {
      setSavingMemberId(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!guest) return null;

  const ownAccepted = guest.rsvp_status === 'accepted_pending' || guest.rsvp_status === 'accepted';
  const ownDeclined = guest.rsvp_status === 'declined_pending' || guest.rsvp_status === 'declined';
  const deadlineFormatted = deadline ? formatDeadline(deadline, language) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
      {deadlineFormatted && (
        <Text style={{ fontSize: 13, color: theme.colors.muted, marginBottom: theme.spacing.lg }}>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent }}>
            {guest.firstname} {guest.lastname}
          </Text>
          <StatusBadge status={guest.rsvp_status} t={t} />
        </View>

        {deadlinePassed ? (
          <Text style={{ fontSize: 13, color: theme.colors.muted, marginTop: 4 }}>
            {t('rsvp.deadlinePassed')}
          </Text>
        ) : savingOwn ? (
          <ActivityIndicator color={theme.colors.primary} style={{ alignSelf: 'flex-start' }} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleOwnRsvp(true)}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: ownAccepted ? theme.colors.sage : theme.colors.surface,
                borderWidth: 1,
                borderColor: ownAccepted ? theme.colors.sage : theme.colors.muted,
              }}
            >
              <Text style={{ fontWeight: '600', color: ownAccepted ? '#fff' : theme.colors.muted, fontSize: 14 }}>
                {t('rsvp.accept')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDecline(() => handleOwnRsvp(false))}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: theme.colors.error,
                borderWidth: 1,
                borderColor: theme.colors.error,
              }}
            >
              <Text style={{ fontWeight: '600', color: '#fff', fontSize: 14 }}>
                {t('rsvp.decline')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Gruppenmitglieder */}
      {guest.type === 'family' && guest.group_members.length > 0 && (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.md,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent, marginBottom: 4 }}>
            {t('rsvp.groupTitle')}
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.muted, marginBottom: theme.spacing.md }}>
            {t('rsvp.groupSubtitle')}
          </Text>
          {guest.group_members.map((member: GroupMember) => {
            const mAccepted = member.rsvp_status === 'accepted_pending' || member.rsvp_status === 'accepted';
            const mDeclined = member.rsvp_status === 'declined_pending' || member.rsvp_status === 'declined';
            const isSaving = savingMemberId === member.guest_id;
            const canSet = ownAccepted && !deadlinePassed;
            const isExpanded = expandedMemberId === member.guest_id;
            const setByLabel = member.rsvp_set_by
              ? member.rsvp_set_by.guest_id === guest.guest_id
                ? t('rsvp.setByMe')
                : member.rsvp_set_by.firstname ? t('rsvp.setBy', { name: member.rsvp_set_by.firstname }) : t('rsvp.setByOrganizer')
              : null;
            const memberFullName = `${member.firstname} ${member.lastname}`;

            return (
              <TouchableOpacity
                key={member.guest_id}
                activeOpacity={canSet ? 0.7 : 1}
                onPress={() => canSet && setExpandedMemberId(isExpanded ? null : member.guest_id)}
                style={{ paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }}>
                    {memberFullName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={member.rsvp_status} t={t} />
                    {canSet && (
                      <Text style={{ fontSize: 18, color: theme.colors.muted }}>{isExpanded ? '▲' : '▼'}</Text>
                    )}
                  </View>
                </View>
                {setByLabel && (
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                    {setByLabel}
                  </Text>
                )}
                {isExpanded && (
                  isSaving ? (
                    <ActivityIndicator color={theme.colors.primary} style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }} />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm }}>
                      <TouchableOpacity
                        onPress={() => handleGroupRsvp(member.guest_id, true)}
                        style={{
                          flex: 1,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.borderRadius.md,
                          alignItems: 'center',
                          backgroundColor: mAccepted ? theme.colors.sage : theme.colors.surface,
                          borderWidth: 1,
                          borderColor: mAccepted ? theme.colors.sage : theme.colors.muted,
                        }}
                      >
                        <Text style={{ fontWeight: '600', color: mAccepted ? '#fff' : theme.colors.muted, fontSize: 14 }}>
                          {t('rsvp.accept')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDecline(() => handleGroupRsvp(member.guest_id, false), memberFullName)}
                        style={{
                          flex: 1,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.borderRadius.md,
                          alignItems: 'center',
                          backgroundColor: theme.colors.error,
                          borderWidth: 1,
                          borderColor: theme.colors.error,
                        }}
                      >
                        <Text style={{ fontWeight: '600', color: '#fff', fontSize: 14 }}>
                          {t('rsvp.decline')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      </ScrollView>

      {/* Toast — absolut oben mittig */}
      {refreshed && (
        <View style={{
          position: 'absolute',
          top: insets.top + 12,
          alignSelf: 'center',
          backgroundColor: colors.accent,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: theme.borderRadius.full,
        }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            ✓ {t('common.refreshed')}
          </Text>
        </View>
      )}
    </View>
  );
}
