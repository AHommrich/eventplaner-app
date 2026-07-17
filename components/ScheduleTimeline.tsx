import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { FadeInView } from './FadeInView';
import { GradientFill } from './GradientFill';
import { ThemedText } from './ThemedText';
import { theme } from '../constants/theme';
import { CalendarEvent, stationCalendarEvent, stationHasTime } from '../lib/calendar';
import { useEventTheme } from '../lib/EventThemeContext';
import type { ScheduleStation } from '../lib/guest';
import { useLanguage } from '../lib/LanguageContext';
import { openLocationInMaps } from '../lib/maps';
import { stationState } from '../lib/schedule';
import { cardSurfaceStyle } from '../lib/variantStyles';

function timeRange(station: ScheduleStation): string {
  if (!station.starts_at) return '';
  return station.ends_at ? `${station.starts_at}–${station.ends_at}` : station.starts_at;
}

async function presentCalendarDialog(event: CalendarEvent): Promise<boolean> {
  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: event.start,
      endDate: event.end,
      location: event.location ?? undefined,
    });
    return result.action !== 'canceled';
  } catch (error) {
    console.warn('[Schedule] calendar dialog failed:', error);
    return false;
  }
}

/** Shared schedule presentation; callers provide already-authorized station data. */
export function ScheduleTimeline({
  dateIso,
  stations,
  now,
}: {
  dateIso: string | null;
  stations: ScheduleStation[];
  now: number;
}) {
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const isSoft = variant.key === 'soft-luxury';

  function addStationToCalendar(station: ScheduleStation) {
    if (!dateIso) return;
    const event = stationCalendarEvent(dateIso, stations, station.id);
    if (event) void presentCalendarDialog(event);
  }

  return (
    <>
      <View style={styles.header}>
        <ThemedText
          style={[
            styles.title,
            { color: colors.cardText },
            isSoft && { fontSize: 32, letterSpacing: 0.5 },
          ]}
        >
          {t('schedule.title')}
        </ThemedText>
      </View>

      {stations.length === 0 ? (
        <ThemedText style={{ color: colors.cardText + 'aa' }}>{t('schedule.empty')}</ThemedText>
      ) : (
        stations.map((station, index) => {
          const state = dateIso ? stationState(dateIso, station, new Date(now)) : 'upcoming';
          const isNow = state === 'now';
          const hasNavigation = !!(station.address || (station.lat != null && station.lng != null));
          const canAddToCalendar = !!dateIso && stationHasTime(dateIso, station);
          const range = timeRange(station);

          return (
            <FadeInView
              key={station.id}
              enabled={isSoft}
              delay={index * 70}
              style={[
                styles.card,
                isSoft
                  ? [
                      cardSurfaceStyle(variant, colors.card, colors.border),
                      isNow && { borderWidth: 2, borderColor: colors.primary },
                    ]
                  : {
                      backgroundColor: colors.card,
                      borderColor: isNow ? colors.primary : colors.border + '33',
                      borderWidth: isNow ? 2 : 1,
                    },
                { opacity: state === 'past' ? 0.6 : 1 },
              ]}
            >
              <View style={styles.cardHead}>
                {!!range && (
                  <ThemedText style={[styles.time, { color: colors.cardText }]}>{range}</ThemedText>
                )}
                {isNow && (
                  <View style={[styles.nowBadge, { backgroundColor: colors.primary }]}>
                    <ThemedText style={[styles.nowBadgeText, { color: colors.cardButtonText }]}>
                      {t('schedule.now')}
                    </ThemedText>
                  </View>
                )}
              </View>

              <ThemedText
                style={[
                  styles.stationTitle,
                  { color: colors.cardText },
                  isSoft && { fontSize: 22 },
                ]}
              >
                {station.title}
              </ThemedText>
              {!!station.location_name && (
                <ThemedText style={{ color: colors.cardText + 'cc', marginTop: 2 }}>
                  {station.location_name}
                </ThemedText>
              )}
              {!!station.address && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={colors.cardText + '99'} />
                  <ThemedText style={{ color: colors.cardText + '99', flexShrink: 1 }}>
                    {station.address}
                  </ThemedText>
                </View>
              )}

              {(hasNavigation || canAddToCalendar) && (
                <View style={styles.actions}>
                  {hasNavigation && (
                    <TouchableOpacity
                      onPress={() =>
                        openLocationInMaps(
                          {
                            name: station.location_name,
                            address: station.address,
                            lat: station.lat,
                            lng: station.lng,
                          },
                          t
                        )
                      }
                      activeOpacity={0.7}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.cardButton },
                        isSoft && { borderRadius: variant.radius.button },
                      ]}
                    >
                      {isSoft && (
                        <GradientFill color={colors.cardButton} radius={variant.radius.button} />
                      )}
                      <Ionicons name="navigate-outline" size={16} color={colors.cardButtonText} />
                      <ThemedText style={[styles.actionText, { color: colors.cardButtonText }]}>
                        {t('schedule.route')}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                  {canAddToCalendar && (
                    <TouchableOpacity
                      onPress={() => addStationToCalendar(station)}
                      activeOpacity={0.7}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.cardButton },
                        isSoft && { borderRadius: variant.radius.button },
                      ]}
                    >
                      {isSoft && (
                        <GradientFill color={colors.cardButton} radius={variant.radius.button} />
                      )}
                      <Ionicons name="calendar-outline" size={16} color={colors.cardButtonText} />
                      <ThemedText style={[styles.actionText, { color: colors.cardButtonText }]}>
                        {t('schedule.calendar')}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </FadeInView>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: theme.spacing.sm,
  },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    overflow: 'hidden',
  },
  actionText: { fontSize: 14, fontWeight: '600' },
});
