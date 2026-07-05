/**
 * Bottom tab bar — dynamically shows and hides tabs based on RSVP state,
 * feature toggles, and whether a cover image is set.
 *
 * Tab visibility rules (all layered):
 *   - `home` .......... always shown; when a cover image is set it goes
 *                       "full-bleed" (transparent tab bar with the cover
 *                       image bleeding under it and light-on-dark tint).
 *   - `rsvp` .......... only visible while the guest is in
 *                       `accepted_pending`. After a full `accepted` the tab
 *                       disappears because the RSVP is settled; the RSVP
 *                       screen still lives, it just is no longer linked.
 *   - `photos` ........ always shown.
 *   - `photo-game` .... only when the couple has flipped
 *                       `photo_game_enabled` on the backend.
 *   - `drinks` ........ only when `drink_game_enabled` AND not currently
 *                       drinks-blocked (the latter can flip mid-session; we
 *                       redirect off the drinks tab if the guest is standing
 *                       on it when the block fires).
 *   - `settings` ...... always shown.
 *
 * Tabs are hidden by setting `href: null` — that removes the entry from the
 * router while keeping the screen file registered, which is Expo Router's
 * blessed pattern for conditional tabs.
 */
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  // Start optimistic: assume the guest has full access until fetch resolves,
  // otherwise the RSVP tab would flash-out on every fresh mount.
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('accepted_pending');

  useEffect(() => {
    fetchGuestMe()
      .then((g) => setRsvpStatus(g.rsvp_status))
      .catch(() => {});
  }, []);

  // If drinks are blocked while the guest is standing ON the drinks tab, boot
  // them off with an explanatory alert. Effect keys on `drinksBlocked` so it
  // only fires on the block edge, not on every re-render.
  useEffect(() => {
    if (!drinksBlocked) return;
    const onDrinksTab = segments[segments.length - 1] === 'drinks';
    if (onDrinksTab) {
      Alert.alert(t('drinks.blockedTitle'), t('drinks.blockedMessage'));
      router.replace('/(tabs)/home');
    }
    // Only react to the *transition* into `drinksBlocked === true`, not to
    // every re-render of the parent that hands us a new `router` / `segments`
    // / `t` reference. Adding those as deps would re-fire the alert on
    // every navigation change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinksBlocked]);

  const showRsvpTab = rsvpStatus === 'accepted_pending';
  const showDrinksTab = !drinksBlocked && (eventInfo?.drink_game_enabled === true);
  const showPhotoGameTab = eventInfo?.photo_game_enabled === true;
  const hasCover = !!eventInfo?.cover_image_url;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabTint,
        tabBarInactiveTintColor: colors.tabTint + '66',
        tabBarStyle: {
          backgroundColor: colors.screenBg,
          borderTopColor: colors.border + '33',
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
          // Home tab uses `homeText` when a cover is set so labels stay legible
          // over the image; otherwise the standard tab tint applies.
          tabBarActiveTintColor: hasCover ? (colors.homeText ?? colors.tabTint) : colors.tabTint,
          tabBarInactiveTintColor: hasCover ? 'rgba(255,255,255,0.55)' : colors.tabTint + '66',
          tabBarStyle: hasCover
            ? { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 }
            : { backgroundColor: colors.screenBg, borderTopColor: colors.border + '33', borderTopWidth: 1 },
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
        name="photo-game"
        options={{
          title: t('photoGame.tab'),
          href: showPhotoGameTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
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
