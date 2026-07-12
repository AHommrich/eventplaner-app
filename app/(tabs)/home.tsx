/**
 * Home tab — the "landing after login" screen.
 *
 * Content, top-to-bottom:
 *   1. Optional cover image (from `EventInfo.cover_image_url`) rendered as a
 *      full-bleed background with a configurable dark overlay (see
 *      `home_shadow_opacity` and `color_home_shadow`).
 *   2. Welcome line ("Hallo {name}").
 *   3. Event title + formatted date + venue block (see `openInMaps` below
 *      for the tap-to-navigate rules).
 *   4. Dresscode (optional).
 *   5. Live countdown pill — updates every 1 s until day-of, then flips to
 *      "today" and finally to "past".
 *
 * Refresh: pull-to-refresh runs `loadData` which re-fetches `EventInfo` AND
 * calls `loadTheme()` so colour changes on the backend propagate. The
 * `useFocusEffect` runs `loadData` on every tab focus for the same reason
 * without needing a manual pull.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ImageBackground,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { CardSkeleton } from '../../components/ui/ScreenSkeletons';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { getSession, GuestSession } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { fetchEventInfo, EventInfo } from '../../lib/guest';
import { focusStation, scheduleStatus } from '../../lib/schedule';
import { openLocationInMaps } from '../../lib/maps';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

/** Venue tap-to-navigate — delegates to the shared maps dispatcher. */
function openInMaps(event: EventInfo, t: (k: string) => string) {
  openLocationInMaps(
    {
      name: event.venue_name,
      address: event.venue_address,
      lat: event.venue_lat,
      lng: event.venue_lng,
    },
    t
  );
}

function formatEventDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

type CountdownParts =
  { days: number; hours: number; minutes: number; seconds: number } | 'today' | 'past';

/**
 * Countdown state calculator. Returns `'today'` for the full 24 h window
 * around the event start (0 ..> -24 h from the target), `'past'` after that,
 * and a broken-down `{days, hours, minutes, seconds}` tuple otherwise.
 */
function calcCountdown(iso: string): CountdownParts {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0 && diff > -86_400_000) return 'today';
  if (diff <= -86_400_000) return 'past';
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

export default function HomeScreen() {
  const { t, language } = useLanguage();
  const { colors, loadTheme } = useEventTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [session, setSession] = useState<GuestSession | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownParts | null>(null);
  // Ticks with the countdown so the station status can be derived purely from
  // state in render (no `Date.now()` during render).
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocused = useIsFocused();

  async function loadData() {
    try {
      const info = await fetchEventInfo();
      setEventInfo(info);
      await loadTheme();
      setLoadError(null);
    } catch (e: any) {
      console.warn('[Home] fetchEventInfo failed:', e?.response?.status, e?.message);
      setLoadError(`${e?.response?.status ?? ''} ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  // Re-fetch on every focus so a mid-session backend change (e.g. new cover
  // image, updated deadline) is reflected without a pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      loadData();
      // Focus-effect callback intentionally captured once — recreating it per
      // render would defeat useFocusEffect's "run when route becomes active"
      // semantic and re-fire on every parent render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // 1 Hz ticker for the countdown pill — cheap because `calcCountdown` is
  // pure arithmetic; teardown on eventInfo change so a fresh date doesn't
  // race the old interval. The synchronous `setCountdown` seeds the pill
  // BEFORE the first interval tick so the guest never sees a 1 s "empty"
  // frame — React 19's `set-state-in-effect` check is overzealous here
  // (same-value updates bail out of scheduling), so we opt out per line.
  // Gated on `isFocused` so the interval doesn't keep ticking (and burning
  // CPU) while the guest is on another tab — it reseeds correctly on refocus.
  useEffect(() => {
    if (!eventInfo?.date || !isFocused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(calcCountdown(eventInfo.date));
    setNow(Date.now());
    intervalRef.current = setInterval(() => {
      setCountdown(calcCountdown(eventInfo!.date));
      setNow(Date.now());
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // We only need to reset the ticker when the actual date changes or focus
    // flips. The full `eventInfo` object would trigger on every unrelated
    // theme/schedule tweak the backend returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventInfo?.date, isFocused]);

  const { refreshing, refreshed, onRefresh } = useRefreshToast(loadData);

  const hasCover = !!eventInfo?.cover_image_url;
  // On a cover image, `homeText` is the couple-picked legible colour; without
  // one, we fall back to the standard cardText tone.
  const textColor = hasCover && colors.homeText ? colors.homeText : colors.cardText;
  const pillBg = hasCover && colors.homeText ? 'rgba(0,0,0,0.35)' : colors.primary;
  const pillText = hasCover && colors.homeText ? colors.homeText : colors.cardButtonText;
  const eventDate = eventInfo?.date ? formatEventDate(eventInfo.date, language) : null;

  function renderCountdown() {
    // When the event has timed stations, the pill walks through them: counts
    // down to the next stop, then flips to "Now: <station>" while it runs, then
    // moves on. Recomputed each render, which the 1 Hz ticker drives. Falls back
    // to the plain event-date countdown when there are no stations.
    const stations = eventInfo?.schedule_stations ?? [];
    const status =
      eventInfo?.date && stations.length
        ? scheduleStatus(eventInfo.date, stations, new Date(now))
        : null;

    let label: string;
    if (status) {
      if (status.kind === 'during') {
        label = t('home.stationNow', { title: status.station.title });
      } else if (status.kind === 'after') {
        label = t('home.countdownPast');
      } else {
        const totalSec = Math.max(0, Math.floor((status.target.getTime() - now) / 1000));
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        const time = `${hours}${t('home.countdownHours')} ${minutes}${t('home.countdownMinutes')} ${seconds}${t('home.countdownSeconds')}`;
        label = t('home.stationCountdown', { time, title: status.station.title });
      }
    } else if (!countdown) {
      return null;
    } else if (countdown === 'today') {
      label = t('home.countdownToday');
    } else if (countdown === 'past') {
      label = t('home.countdownPast');
    } else {
      const { days, hours, minutes, seconds } = countdown;
      const p = t('home.countdownPrefix');
      const d = t('home.countdownDays');
      const h = t('home.countdownHours');
      const m = t('home.countdownMinutes');
      const s = t('home.countdownSeconds');
      label = `${p} ${days}${d} ${hours}${h} ${minutes}${m} ${seconds}${s}`;
    }
    return (
      <View style={styles.pillRow}>
        <View style={[styles.pill, { backgroundColor: pillBg }]}>
          <ThemedText style={[styles.pillText, { color: pillText }]}>{label}</ThemedText>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.screenBg, paddingTop: insets.top + theme.spacing.lg },
        ]}
      >
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <CardSkeleton lines={4} />
        </View>
      </View>
    );
  }

  const content = (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: (hasCover ? tabBarHeight : insets.bottom) + theme.spacing.xl },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={hasCover ? '#fff' : colors.tabTint}
          colors={[colors.tabTint]}
        />
      }
    >
      {loadError && (
        <ErrorBanner
          message={t('home.loadError')}
          onRetry={loadData}
          style={{ marginBottom: theme.spacing.sm }}
        />
      )}
      {session && (
        <ThemedText style={[styles.welcome, { color: textColor }]}>
          {t('home.welcome', { name: session.firstname })}
        </ThemedText>
      )}
      {eventInfo?.name && (
        <ThemedText style={[styles.title, { color: textColor }]}>{eventInfo.name}</ThemedText>
      )}
      {eventDate && (
        <ThemedText style={[styles.meta, { color: textColor }]}>{eventDate}</ThemedText>
      )}
      {(() => {
        // When the event has schedule stations, the location block follows the
        // active/next station (same one the countdown pill walks) instead of the
        // static venue — so guests always see where to head next.
        const stations = eventInfo?.schedule_stations ?? [];
        const focus =
          eventInfo?.date && stations.length
            ? focusStation(eventInfo.date, stations, new Date(now))
            : null;
        if (focus) {
          const focusHasNav = !!(focus.address || (focus.lat != null && focus.lng != null));
          if (!focusHasNav && !focus.location_name) return null;
          const focusAddr = focus.address ?? `${focus.lat?.toFixed(4)}, ${focus.lng?.toFixed(4)}`;
          const inner = (
            <>
              {!!focus.location_name && (
                <ThemedText
                  style={[styles.meta, { color: textColor, marginBottom: 0, fontSize: 18 }]}
                >
                  {focus.location_name}
                </ThemedText>
              )}
              {focusHasNav && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ThemedText
                    style={[styles.meta, { color: textColor, marginBottom: 0, fontSize: 18 }]}
                  >
                    {focusAddr}
                  </ThemedText>
                  <Ionicons name="location-outline" size={15} color={textColor} />
                </View>
              )}
            </>
          );
          return focusHasNav ? (
            <TouchableOpacity
              onPress={() =>
                openLocationInMaps(
                  {
                    name: focus.location_name,
                    address: focus.address,
                    lat: focus.lat,
                    lng: focus.lng,
                  },
                  t
                )
              }
              activeOpacity={0.7}
              style={{ alignItems: 'center', marginVertical: 8 }}
            >
              {inner}
            </TouchableOpacity>
          ) : (
            <View style={{ alignItems: 'center', marginVertical: 8 }}>{inner}</View>
          );
        }

        // Venue block — three display modes controlled by
        // `venue_display_mode`: `'address'` shows address only, `'name'`
        // shows the venue name only, `'both'` stacks name over address with
        // a single tap target and a single pin icon.
        const displayMode = eventInfo?.venue_display_mode ?? 'both';
        const hasNav = !!(
          eventInfo &&
          (eventInfo.venue_address || (eventInfo.venue_lat != null && eventInfo.venue_lng != null))
        );
        const showName = displayMode !== 'address' && !!eventInfo?.venue_name;
        const showAddress = displayMode !== 'name' && hasNav;
        const bothVisible = showName && showAddress;

        if (!showName && !showAddress) return null;

        const addrText =
          eventInfo?.venue_address ??
          `${eventInfo?.venue_lat?.toFixed(4)}, ${eventInfo?.venue_lng?.toFixed(4)}`;

        // `both`: one combined button, name on top and address+icon below.
        if (bothVisible) {
          return (
            <TouchableOpacity
              onPress={() => openInMaps(eventInfo!, t)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', marginVertical: 8 }}
            >
              <ThemedText
                style={[styles.meta, { color: textColor, marginBottom: 0, fontSize: 18 }]}
              >
                {eventInfo!.venue_name}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ThemedText
                  style={[styles.meta, { color: textColor, marginBottom: 0, fontSize: 18 }]}
                >
                  {addrText}
                </ThemedText>
                <Ionicons name="location-outline" size={15} color={textColor} />
              </View>
            </TouchableOpacity>
          );
        }

        // `name` OR `address` only — one label, optional pin icon.
        return hasNav ? (
          <TouchableOpacity
            onPress={() => openInMaps(eventInfo!, t)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 8 }}
          >
            <ThemedText style={[styles.meta, { color: textColor, marginBottom: 0, fontSize: 18 }]}>
              {showName ? eventInfo!.venue_name : addrText}
            </ThemedText>
            <Ionicons name="location-outline" size={15} color={textColor} />
          </TouchableOpacity>
        ) : (
          <ThemedText style={[styles.meta, { color: textColor, fontSize: 18 }]}>
            {eventInfo!.venue_name}
          </ThemedText>
        );
      })()}
      {eventInfo?.dresscode && (
        <View style={{ alignItems: 'center', marginBottom: 2 }}>
          <ThemedText style={[styles.meta, { color: textColor, opacity: 0.7, marginBottom: 0 }]}>
            {t('home.dresscode')}
          </ThemedText>
          <ThemedText style={[styles.meta, { color: textColor, opacity: 0.7, marginBottom: 0 }]}>
            {eventInfo.dresscode}
          </ThemedText>
        </View>
      )}
      {renderCountdown()}
    </ScrollView>
  );

  if (hasCover) {
    return (
      <ImageBackground
        source={{ uri: eventInfo!.cover_image_url! }}
        style={styles.container}
        resizeMode="cover"
      >
        {/* Cover overlay — simple View with backgroundColor + opacity beats a
            LinearGradient here because the tint is a solid colour, not a
            gradient, and the pointerEvents="none" lets touches pass through. */}
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.homeShadow,
            opacity: (eventInfo?.home_shadow_opacity ?? 50) / 100,
          }}
          pointerEvents="none"
        />
        {content}
        <RefreshToast visible={refreshed} refreshing={refreshing} />
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg }]}>
      {content}
      <RefreshToast visible={refreshed} refreshing={refreshing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  welcome: {
    fontSize: 15,
    opacity: 0.85,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  meta: {
    fontSize: 15,
    opacity: 0.85,
    marginBottom: 2,
    textAlign: 'center',
  },
  pillRow: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
