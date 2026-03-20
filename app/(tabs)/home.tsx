import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ImageBackground, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { getSession, GuestSession } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { fetchEventInfo, EventInfo } from '../../lib/guest';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

function openInMaps(event: EventInfo, t: (k: string) => string) {
  const label = encodeURIComponent(event.venue_name ?? event.venue_address ?? '');
  const hasCoords = event.venue_lat != null && event.venue_lng != null;
  const lat = event.venue_lat;
  const lng = event.venue_lng;

  // Apple Maps: ll= für exakte Koordinaten, sonst Adresse
  const appleUrl = hasCoords
    ? `maps://?ll=${lat},${lng}&q=${label}`
    : `maps://?q=${encodeURIComponent(event.venue_address ?? '')}`;
  // Google Maps (iOS): q=lat,lng pinnt exakt
  const googleUrl = hasCoords
    ? `comgooglemaps://?q=${lat},${lng}&zoom=16`
    : `comgooglemaps://?q=${encodeURIComponent(event.venue_address ?? '')}`;
  // Android: q=lat,lng(label) pinnt exakt
  const androidUrl = hasCoords
    ? `geo:${lat},${lng}?q=${lat},${lng}(${label})`
    : `geo:0,0?q=${encodeURIComponent(event.venue_address ?? '')}`;

  if (Platform.OS === 'ios') {
    Alert.alert(t('home.openInMaps'), t('home.openInMapsHint'), [
      { text: t('home.mapsApple'), onPress: () => Linking.openURL(appleUrl) },
      {
        text: t('home.mapsGoogle'),
        onPress: () => Linking.openURL(googleUrl).catch(() => Linking.openURL(appleUrl)),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  } else {
    Linking.openURL(androidUrl);
  }
}

function formatEventDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

type CountdownParts = { days: number; hours: number; minutes: number; seconds: number } | 'today' | 'past';

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    try {
      const info = await fetchEventInfo();
      setEventInfo(info);
      await loadTheme();
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

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  useEffect(() => {
    if (!eventInfo?.date) return;
    setCountdown(calcCountdown(eventInfo.date));
    intervalRef.current = setInterval(() => setCountdown(calcCountdown(eventInfo!.date)), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [eventInfo?.date]);

  const { refreshing, refreshed, onRefresh } = useRefreshToast(loadData);

  const hasCover = !!eventInfo?.cover_image_url;
  const textColor = (hasCover && colors.homeText) ? colors.homeText : colors.cardText;
  const pillBg = (hasCover && colors.homeText) ? 'rgba(0,0,0,0.35)' : colors.primary;
  const pillText = (hasCover && colors.homeText) ? colors.homeText : colors.cardButtonText;
  const eventDate = eventInfo?.date ? formatEventDate(eventInfo.date, language) : null;

  function renderCountdown() {
    if (!countdown) return null;
    let label: string;
    if (countdown === 'today') {
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
      <View style={[styles.container, { backgroundColor: colors.screenBg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.tabTint} />
      </View>
    );
  }

  const content = (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: (hasCover ? tabBarHeight : insets.bottom) + theme.spacing.xl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={hasCover ? '#fff' : colors.tabTint} colors={[colors.tabTint]} />}
    >
      {loadError && (
        <ThemedText style={{ color: 'red', fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
          {t('home.loadError')}
        </ThemedText>
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
      {eventInfo?.venue_name && (
        <ThemedText style={[styles.meta, { color: textColor }]}>{eventInfo.venue_name}</ThemedText>
      )}
      {eventInfo && (eventInfo.venue_address || (eventInfo.venue_lat != null && eventInfo.venue_lng != null)) ? (
        <TouchableOpacity
          onPress={() => openInMaps(eventInfo, t)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}
        >
          <ThemedText style={[styles.meta, { color: textColor, marginBottom: 0 }]}>
            {eventInfo.venue_address ?? `${eventInfo.venue_lat?.toFixed(4)}, ${eventInfo.venue_lng?.toFixed(4)}`}
          </ThemedText>
          <Ionicons name="location-outline" size={12} color={textColor} />
        </TouchableOpacity>
      ) : null}
      {eventInfo?.dresscode && (
        <ThemedText style={[styles.meta, { color: textColor, opacity: 0.7 }]}>{eventInfo.dresscode}</ThemedText>
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
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.65)']}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
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
