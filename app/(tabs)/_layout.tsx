/** Guest tab manifest and visibility rules, rendered through the shared event tab shell. */
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { EventTabIcon, EventTabIconMap, EventTabShell } from '../../components/EventTabShell';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useBlockedFeatures } from '../../lib/BlockedFeaturesContext';
import { fetchGuestMe, RsvpStatus } from '../../lib/guest';

export const GUEST_TAB_MANIFEST = [
  'home',
  'schedule',
  'rsvp',
  'photos',
  'photo-game',
  'drinks',
  'settings',
] as const;

const GUEST_TAB_ICONS: EventTabIconMap = {
  home: 'home-outline',
  schedule: 'time-outline',
  rsvp: 'checkmark-circle-outline',
  photos: 'images-outline',
  'photo-game': 'camera-outline',
  drinks: 'beer-outline',
  settings: 'settings-outline',
};

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors, eventInfo, variant } = useEventTheme();
  const { drinksBlocked } = useBlockedFeatures();
  const router = useRouter();
  const segments = useSegments();
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('accepted_pending');

  useEffect(() => {
    fetchGuestMe()
      .then((guest) => setRsvpStatus(guest.rsvp_status))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!drinksBlocked) return;
    const onDrinksTab = segments[segments.length - 1] === 'drinks';
    if (onDrinksTab) {
      Alert.alert(t('drinks.blockedTitle'), t('drinks.blockedMessage'));
      router.replace('/(tabs)/home');
    }
    // Only react to the transition into a blocked state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinksBlocked]);

  const showRsvpTab = rsvpStatus === 'accepted_pending';
  const showDrinksTab = !drinksBlocked && eventInfo?.drink_game_enabled === true;
  const showPhotoGameTab = eventInfo?.photo_game_enabled === true;
  const showScheduleTab = (eventInfo?.schedule_stations?.length ?? 0) >= 2;
  const hasCover = !!eventInfo?.cover_image_url;
  const isSheet = variant.tabBar === 'sheet';
  const currentTab = segments[segments.length - 1] ?? 'home';
  const overCover = isSheet && hasCover && (currentTab === 'home' || currentTab === '(tabs)');
  const hiddenTabs = new Set<string>();
  if (!showScheduleTab) hiddenTabs.add('schedule');
  if (!showRsvpTab) hiddenTabs.add('rsvp');
  if (!showPhotoGameTab) hiddenTabs.add('photo-game');
  if (!showDrinksTab) hiddenTabs.add('drinks');

  const classicTabBarStyle = {
    backgroundColor: colors.navBg,
    borderTopColor: colors.border + '33',
    borderTopWidth: 1,
  };

  return (
    <EventTabShell
      icons={GUEST_TAB_ICONS}
      hiddenTabs={hiddenTabs}
      overCover={overCover}
      classicTabBarStyle={classicTabBarStyle}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarActiveTintColor:
            hasCover && !isSheet ? (colors.homeText ?? colors.tabTint) : colors.tabTint,
          tabBarInactiveTintColor:
            hasCover && !isSheet ? 'rgba(255,255,255,0.55)' : colors.tabTint + '66',
          tabBarStyle:
            hasCover && !isSheet
              ? {
                  position: 'absolute',
                  backgroundColor: 'transparent',
                  borderTopWidth: 0,
                  elevation: 0,
                  shadowOpacity: 0,
                }
              : classicTabBarStyle,
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('tabs.schedule'),
          href: showScheduleTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="time-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="rsvp"
        options={{
          title: t('tabs.rsvp'),
          href: showRsvpTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="checkmark-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t('tabs.photos'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="images-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="photo-game"
        options={{
          title: t('photoGame.tab'),
          href: showPhotoGameTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="camera-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="drinks"
        options={{
          title: t('tabs.drinks'),
          href: showDrinksTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="beer-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </EventTabShell>
  );
}
