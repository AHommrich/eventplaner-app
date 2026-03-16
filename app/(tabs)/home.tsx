import { useEffect, useState } from 'react';
import { View, Text, ImageBackground, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession, GuestSession } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';

function formatEventDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function HomeScreen() {
  const { t, language } = useLanguage();
  const { eventInfo, colors } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<GuestSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadTheme();
    setRefreshing(false);
  }

  const hasCover = !!eventInfo?.cover_image_url;
  const textColor = hasCover ? colors.homeText : colors.primary;
  const eventDate = eventInfo?.date ? formatEventDate(eventInfo.date, language) : null;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={hasCover ? '#fff' : colors.primary}
    />
  );

  const content = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xl }]}
      refreshControl={refreshControl}
    >
      {session && (
        <Text style={[styles.welcome, { color: textColor }]}>
          {t('home.welcome', { name: session.firstname })}
        </Text>
      )}
      {eventInfo?.name && (
        <Text style={[styles.title, { color: textColor }]}>{eventInfo.name}</Text>
      )}
      {eventDate && (
        <Text style={[styles.meta, { color: textColor }]}>{eventDate}</Text>
      )}
      {eventInfo?.venue_name && (
        <Text style={[styles.meta, { color: textColor }]}>{eventInfo.venue_name}</Text>
      )}
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
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {content}
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
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
  },
  welcome: {
    fontSize: 15,
    opacity: 0.85,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
  },
  meta: {
    fontSize: 15,
    opacity: 0.85,
    marginBottom: 2,
  },
});
