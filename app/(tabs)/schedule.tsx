/**
 * Schedule tab — the event timeline as the guest may see it. Stations arrive
 * pre-filtered by the backend (per-group visibility), so this screen just
 * renders them, marks the one running right now, and offers two hand-offs per
 * stop: open the location in a maps app, or add it to the guest's calendar via
 * the OS's native event dialog (expo-calendar). Shown in the tab bar only when
 * the guest can see at least two stations (see `_layout.tsx`); a single stop
 * stays on the home card.
 */
import { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { ThemedText } from '../../components/ThemedText';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { ScheduleStation } from '../../lib/guest';
import { stationState } from '../../lib/schedule';
import {
  CalendarEvent,
  stationCalendarEvent,
  stationHasTime,
} from '../../lib/calendar';
import { openLocationInMaps } from '../../lib/maps';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { theme } from '../../constants/theme';

function timeRange(s: ScheduleStation): string {
  if (!s.starts_at) return '';
  return s.ends_at ? `${s.starts_at}–${s.ends_at}` : s.starts_at;
}

// Opens the OS's native "new event" dialog pre-filled. The user picks which
// calendar to save into (iCloud, Google, …) — that, not a direct write, is what
// reaches third-party calendar apps like Family Wallet, and it needs no
// up-front permission prompt. Resolves to false when the user cancels.
async function presentCalendarDialog(ev: CalendarEvent): Promise<boolean> {
  try {
    const res = await Calendar.createEventInCalendarAsync({
      title: ev.title,
      startDate: ev.start,
      endDate: ev.end,
      location: ev.location ?? undefined,
    });
    return res.action !== 'canceled';
  } catch (e) {
    console.warn('[Schedule] calendar dialog failed:', e);
    return false;
  }
}

export default function ScheduleScreen() {
  const { t } = useLanguage();
  const { colors, eventInfo, loadTheme } = useEventTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { refreshing, refreshed, onRefresh } = useRefreshToast(loadTheme);
  const [now, setNow] = useState(() => Date.now());

  // 1 Hz ticker so the "Now" marker follows the clock while focused; paused off
  // this tab to avoid needless renders.
  useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isFocused]);

  const stations = eventInfo?.schedule_stations ?? [];
  const dateIso = eventInfo?.date ?? null;

  function addStationToCalendar(s: ScheduleStation) {
    if (!dateIso) return;
    const ev = stationCalendarEvent(dateIso, stations, s.id);
    if (ev) presentCalendarDialog(ev);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg, paddingTop: insets.top }]}>
      <RefreshToast visible={refreshed} refreshing={refreshing} />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: tabBarHeight + theme.spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tabTint}
            colors={[colors.tabTint]}
          />
        }
      >
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.cardText }]}>
            {t('schedule.title')}
          </ThemedText>
        </View>

        {stations.length === 0 ? (
          <ThemedText style={{ color: colors.cardText + 'aa' }}>{t('schedule.empty')}</ThemedText>
        ) : (
          stations.map((s) => {
            const state = dateIso ? stationState(dateIso, s, new Date(now)) : 'upcoming';
            const isNow = state === 'now';
            const hasNav = !!(s.address || (s.lat != null && s.lng != null));
            const canCalendar = !!dateIso && stationHasTime(dateIso, s);
            const range = timeRange(s);

            return (
              <View
                key={s.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isNow ? colors.primary : colors.border + '33',
                    borderWidth: isNow ? 2 : 1,
                    opacity: state === 'past' ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.cardHead}>
                  {!!range && (
                    <ThemedText style={[styles.time, { color: colors.cardText }]}>
                      {range}
                    </ThemedText>
                  )}
                  {isNow && (
                    <View style={[styles.nowBadge, { backgroundColor: colors.primary }]}>
                      <ThemedText style={[styles.nowBadgeText, { color: colors.cardButtonText }]}>
                        {t('schedule.now')}
                      </ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText style={[styles.stationTitle, { color: colors.cardText }]}>
                  {s.title}
                </ThemedText>
                {!!s.location_name && (
                  <ThemedText style={{ color: colors.cardText + 'cc', marginTop: 2 }}>
                    {s.location_name}
                  </ThemedText>
                )}
                {!!s.address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={14} color={colors.cardText + '99'} />
                    <ThemedText style={{ color: colors.cardText + '99', flexShrink: 1 }}>
                      {s.address}
                    </ThemedText>
                  </View>
                )}

                {(hasNav || canCalendar) && (
                  <View style={styles.actions}>
                    {hasNav && (
                      <TouchableOpacity
                        onPress={() =>
                          openLocationInMaps(
                            { name: s.location_name, address: s.address, lat: s.lat, lng: s.lng },
                            t
                          )
                        }
                        activeOpacity={0.7}
                        style={[styles.actionBtn, { borderColor: colors.border + '55' }]}
                      >
                        <Ionicons name="navigate-outline" size={16} color={colors.cardButton} />
                        <ThemedText style={[styles.actionText, { color: colors.cardText }]}>
                          {t('schedule.route')}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                    {canCalendar && (
                      <TouchableOpacity
                        onPress={() => addStationToCalendar(s)}
                        activeOpacity={0.7}
                        style={[styles.actionBtn, { borderColor: colors.border + '55' }]}
                      >
                        <Ionicons name="calendar-outline" size={16} color={colors.cardButton} />
                        <ThemedText style={[styles.actionText, { color: colors.cardText }]}>
                          {t('schedule.calendar')}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  title: { fontSize: 24, fontWeight: '700' },
  card: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nowBadge: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  nowBadgeText: { fontSize: 11, fontWeight: '700' },
  stationTitle: { fontSize: 19, fontWeight: '600', marginTop: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: theme.spacing.sm },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
  },
  actionText: { fontSize: 14, fontWeight: '600' },
});
