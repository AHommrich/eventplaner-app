/**
 * RSVP tab — accepted_pending guests manage their own and their family's
 * RSVP responses here.
 *
 * Visibility: the tab bar hides this route once the guest reaches `accepted`
 * (see `app/(tabs)/_layout.tsx`), so this screen is only ever reachable in
 * the `accepted_pending` transition window. `loadData()` also route-guards:
 *   - `isDeclinedFlow(status)` .. bounce to `/declined`.
 *   - `status === 'accepted'` ... bounce to `/(tabs)/home` (RSVP done).
 * The guard exists so pull-to-refresh AFTER the couple confirms the
 * acceptance actually removes the screen from the guest's view.
 *
 * Family flow: the current guest can set RSVPs for every `group_members[]`
 * entry — the backend enforces that the ids belong to the same family. Each
 * member row is collapsed by default; tapping the row expands to reveal
 * accept/decline buttons (`expandedMemberId`). This keeps the list dense
 * for large families.
 *
 * Deadline handling: `deadlinePassed` disables every button and shows a
 * copy string; no post-deadline mutation is possible.
 */
import { useCallback, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
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
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

function formatDeadline(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Small pill badge — green for accepted (any variant), red for declined
 * (any variant), grey for anything else. Wraps the status colour choice in
 * one place so a status enum tweak only needs a single edit.
 */
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
      <ThemedText style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
        {accepted ? t('rsvp.statusAccepted') : t('rsvp.statusDeclined')}
      </ThemedText>
    </View>
  );
}

export default function RsvpTabScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors, loadTheme } = useEventTheme();
  const insets = useSafeAreaInsets();

  const [guest, setGuest] = useState<GuestMe | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOwn, setSavingOwn] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<number | null>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const { refreshing, refreshed, onRefresh } = useRefreshToast(async () => { await loadData(true); loadTheme(); });

  async function loadData(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [g, info] = await Promise.all([fetchGuestMe(), fetchEventInfo()]);
      // Route guards — see file header for why this happens on every fetch.
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
    }
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));

  /** Double-confirm gate — decline is destructive so we surface a native alert. */
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

  /**
   * Set another family member's RSVP. Uses an optimistic local update so
   * the badge flips immediately; on error the parent screen shows the alert
   * and the caller must pull-to-refresh to re-sync (rare path).
   */
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

  if (loading && !guest) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screenBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.tabTint} />
      </View>
    );
  }

  if (!guest) return null;

  const ownAccepted = guest.rsvp_status === 'accepted_pending' || guest.rsvp_status === 'accepted';
  const ownDeclined = guest.rsvp_status === 'declined_pending' || guest.rsvp_status === 'declined';
  const deadlineFormatted = deadline ? formatDeadline(deadline, language) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tabTint} colors={[colors.tabTint]} />}
      >
      {/* Own RSVP card. */}
      <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', overflow: 'hidden', marginBottom: theme.spacing.md }}>
        {deadlineFormatted && (
          <ThemedText style={{ fontSize: 12, color: colors.cardText + 'aa', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
            {t('rsvp.subtitle', { deadline: deadlineFormatted })}
          </ThemedText>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.cardText }}>
            {guest.firstname} {guest.lastname}
          </ThemedText>
          <StatusBadge status={guest.rsvp_status} t={t} />
        </View>

        {deadlinePassed ? (
          <ThemedText style={{ fontSize: 13, color: colors.cardText + 'aa', padding: theme.spacing.md }}>
            {t('rsvp.deadlinePassed')}
          </ThemedText>
        ) : savingOwn ? (
          <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', margin: theme.spacing.md }} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, padding: theme.spacing.md }}>
            <TouchableOpacity
              onPress={() => handleOwnRsvp(true)}
              disabled={ownAccepted}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: theme.colors.sage,
                opacity: ownAccepted ? 0.4 : 1,
              }}
            >
              <ThemedText style={{ fontWeight: '600', color: '#fff', fontSize: 14 }}>
                {t('rsvp.accept')}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDecline(() => handleOwnRsvp(false))}
              disabled={ownDeclined}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                backgroundColor: theme.colors.error,
                opacity: ownDeclined ? 0.4 : 1,
              }}
            >
              <ThemedText style={{ fontWeight: '600', color: '#fff', fontSize: 14 }}>
                {t('rsvp.decline')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Family members — collapsible rows, only mutable when the current
          guest has themselves accepted and the deadline has not passed. */}
      {guest.type === 'family' && guest.group_members.length > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', overflow: 'hidden' }}>
          <View style={{ padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.cardText }}>
              {t('rsvp.groupTitle')}
            </ThemedText>
            <ThemedText style={{ fontSize: 13, color: colors.cardText + 'aa', marginTop: 2 }}>
              {t('rsvp.groupSubtitle')}
            </ThemedText>
          </View>
          {guest.group_members.map((member: GroupMember) => {
            const mAccepted = member.rsvp_status === 'accepted_pending' || member.rsvp_status === 'accepted';
            const mDeclined = member.rsvp_status === 'declined_pending' || member.rsvp_status === 'declined';
            const isSaving = savingMemberId === member.guest_id;
            const canSet = ownAccepted && !deadlinePassed;
            const isExpanded = expandedMemberId === member.guest_id;
            // Set-by label: "by me" for own actions, "by <name>" for other
            // family members, "by the organizer" as a fallback when the
            // couple set it via the admin backend.
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
                style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ fontSize: 15, fontWeight: '600', color: colors.cardText }}>
                    {memberFullName}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={member.rsvp_status} t={t} />
                    {canSet && (
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.cardText} />
                    )}
                  </View>
                </View>
                {setByLabel && (
                  <ThemedText style={{ fontSize: 12, color: colors.cardText + 'aa', marginTop: 2 }}>
                    {setByLabel}
                  </ThemedText>
                )}
                {isExpanded && (
                  isSaving ? (
                    <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }} />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm }}>
                      <TouchableOpacity
                        onPress={() => handleGroupRsvp(member.guest_id, true)}
                        disabled={mAccepted}
                        style={{
                          flex: 1,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.borderRadius.md,
                          alignItems: 'center',
                          backgroundColor: theme.colors.sage,
                          opacity: mAccepted ? 0.4 : 1,
                        }}
                      >
                        <ThemedText style={{ fontWeight: '600', color: '#fff', fontSize: 14 }}>
                          {t('rsvp.accept')}
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDecline(() => handleGroupRsvp(member.guest_id, false), memberFullName)}
                        disabled={mDeclined}
                        style={{
                          flex: 1,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.borderRadius.md,
                          alignItems: 'center',
                          backgroundColor: theme.colors.error,
                          opacity: mDeclined ? 0.4 : 1,
                        }}
                      >
                        <ThemedText style={{ fontWeight: '600', color: '#fff', fontSize: 14 }}>
                          {t('rsvp.decline')}
                        </ThemedText>
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

      <RefreshToast visible={refreshed} refreshing={refreshing} />
    </View>
  );
}
