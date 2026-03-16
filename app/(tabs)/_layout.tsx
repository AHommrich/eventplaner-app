import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { fetchGuestMe, RsvpStatus } from '../../lib/guest';
import api from '../../lib/api';

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors, eventInfo } = useEventTheme();
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('accepted_pending');
  const [showDrinksTab, setShowDrinksTab] = useState(true);

  useEffect(() => {
    fetchGuestMe()
      .then((g) => setRsvpStatus(g.rsvp_status))
      .catch(() => {});

    api.get('/api/drinks').catch((e) => {
      if (e?.response?.data?.code === 'drinks_blocked') setShowDrinksTab(false);
    });
  }, []);

  const showRsvpTab = rsvpStatus === 'accepted_pending';
  const hasCover = !!eventInfo?.cover_image_url;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.primary,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarActiveTintColor: hasCover ? colors.homeText : colors.primary,
          tabBarInactiveTintColor: hasCover ? 'rgba(255,255,255,0.55)' : theme.colors.muted,
          tabBarStyle: hasCover
            ? { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 }
            : { backgroundColor: colors.background, borderTopColor: colors.primary, borderTopWidth: 1 },
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
