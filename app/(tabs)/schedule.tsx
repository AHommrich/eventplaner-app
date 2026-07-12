/**
 * Schedule tab — the event timeline as the guest may see it. Stations arrive
 * pre-filtered by the backend (per-group visibility), so this screen just
 * renders them, marks the one running right now, and hands each location off to
 * the maps dispatcher. Shown in the tab bar only when the guest can see at
 * least two stations (see `_layout.tsx`); a single stop stays on the home card.
 */
import { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { ScheduleStation } from '../../lib/guest';
import { stationState } from '../../lib/schedule';
import { openLocationInMaps } from '../../lib/maps';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { theme } from '../../constants/theme';

function timeRange(s: ScheduleStation): string {
  if (!s.starts_at) return '';
  return s.ends_at ? `${s.starts_at}–${s.ends_at}` : s.starts_at;
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
        <ThemedText style={[styles.title, { color: colors.cardText }]}>
          {t('schedule.title')}
        </ThemedText>

        {stations.length === 0 ? (
          <ThemedText style={{ color: colors.cardText + 'aa' }}>{t('schedule.empty')}</ThemedText>
        ) : (
          stations.map((s) => {
            const state = dateIso ? stationState(dateIso, s, new Date(now)) : 'upcoming';
            const isNow = state === 'now';
            const hasNav = !!(s.address || (s.lat != null && s.lng != null));
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
                    opacity: state === 'past' ? 0.55 : 1,
                  },
                ]}
              >
                <View style={styles.headerRow}>
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

                {hasNav && (
                  <TouchableOpacity
                    onPress={() =>
                      openLocationInMaps(
                        { name: s.location_name, address: s.address, lat: s.lat, lng: s.lng },
                        t
                      )
                    }
                    activeOpacity={0.7}
                    style={styles.addressRow}
                  >
                    <Ionicons name="location-outline" size={15} color={colors.cardText + 'aa'} />
                    <ThemedText style={{ color: colors.cardText + 'aa', flexShrink: 1 }}>
                      {s.address ?? `${s.lat?.toFixed(4)}, ${s.lng?.toFixed(4)}`}
                    </ThemedText>
                  </TouchableOpacity>
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
  title: { fontSize: 24, fontWeight: '700', marginBottom: theme.spacing.md },
  card: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nowBadge: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  nowBadgeText: { fontSize: 11, fontWeight: '700' },
  stationTitle: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.sm },
});
