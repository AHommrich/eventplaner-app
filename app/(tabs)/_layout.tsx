import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useBlockedFeatures } from '../../lib/BlockedFeaturesContext';
import { fetchGuestMe, RsvpStatus } from '../../lib/guest';

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors, eventInfo } = useEventTheme();
  const { drinksBlocked } = useBlockedFeatures();
  const router = useRouter();
  const segments = useSegments();
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('accepted_pending');

  useEffect(() => {
    fetchGuestMe()
      .then((g) => setRsvpStatus(g.rsvp_status))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!drinksBlocked) return;
    const onDrinksTab = segments[segments.length - 1] === 'drinks';
    if (onDrinksTab) {
      Alert.alert(t('drinks.blockedTitle'), t('drinks.blockedMessage'));
      router.replace('/(tabs)/home');
    }
  }, [drinksBlocked]);

  const showRsvpTab = rsvpStatus === 'accepted_pending';
  const showDrinksTab = !drinksBlocked && (eventInfo?.drink_game_enabled === true);
  const hasCover = !!eventInfo?.cover_image_url;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabTint,
        tabBarInactiveTintColor: colors.tabTint + '66',
        tabBarStyle: {
          backgroundColor: colors.screenBg,
          borderTopColor: colors.tabTint + '40',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: colors.fontFamily
          ? { fontFamily: colors.fontFamily.regular }
          : undefined,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarActiveTintColor: hasCover ? (colors.homeText ?? colors.tabTint) : colors.tabTint,
          tabBarInactiveTintColor: hasCover ? 'rgba(255,255,255,0.55)' : colors.tabTint + '66',
          tabBarStyle: hasCover
            ? { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 }
            : { backgroundColor: colors.screenBg, borderTopColor: colors.tabTint + '40', borderTopWidth: 1 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rsvp"
        options={{
          title: t('tabs.rsvp'),
          href: showRsvpTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t('tabs.photos'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="drinks"
        options={{
          title: t('tabs.drinks'),
          href: showDrinksTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="beer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
