/**
 * Bottom tab bar — dynamically shows and hides tabs based on RSVP state,
 * feature toggles, and whether a cover image is set.
 *
 * Tab visibility rules (all layered):
 *   - `home` .......... always shown; when a cover image is set it goes
 *                       "full-bleed" (the tab bar floats over the image).
 *   - `schedule` ...... only when the guest can see at least two schedule stops.
 *   - `rsvp` .......... only visible while the guest is in `accepted_pending`.
 *   - `photos` ........ always shown.
 *   - `photo-game` .... only when the couple flipped `photo_game_enabled`.
 *   - `drinks` ........ only when `drink_game_enabled` AND not drinks-blocked.
 *   - `settings` ...... always shown.
 *
 * Conditional tabs are hidden with `href: null` (Expo Router's blessed pattern).
 *
 * Presets:
 *   - classic ....... the default docked hairline bar, untouched.
 *   - soft-luxury ... a floating, frosted (dosed BlurView) rounded bar via
 *                     `tabBarStyle: { position:'absolute' }`, so content bleeds
 *                     full-height behind it. A single filled "pill" indicator
 *                     lives in `tabBarBackground` and SLIDES between tabs on
 *                     every change (the movement); the active icon + label ride
 *                     on top of it in white.
 */
import { ComponentProps, useEffect, useState } from 'react';
import { Alert, Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { sheenGradient } from '../../lib/variantStyles';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useBlockedFeatures } from '../../lib/BlockedFeaturesContext';
import { fetchGuestMe, RsvpStatus } from '../../lib/guest';

const BAR_HEIGHT = 72;
const BAR_MARGIN = 14;

/** Plain tab-bar icon; colour comes from the navigator tint (active vs muted). */
function TabBarIcon({
  name,
  color,
  size,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

/**
 * Frosted background for the soft-luxury bar PLUS the sliding pill indicator.
 * The pill springs horizontally to sit under whichever tab is active, which is
 * the "movement" — the icons/labels stay put and just recolour. Driven by the
 * active index (from the router) rather than per-icon focus state, so it can't
 * be reset by react-navigation recreating the icon components.
 */
function FrostedTabBackground({
  activeIndex,
  count,
  card,
  tabTint,
  radius,
}: {
  activeIndex: number;
  count: number;
  card: string;
  tabTint: string;
  radius: number;
}) {
  // Measure the bar's actual inner width instead of estimating from the window
  // — react-navigation's exact tab layout is what the pill must line up with,
  // otherwise a per-tab rounding error accumulates and drifts sideways.
  const [barW, setBarW] = useState(0);
  const tabWidth = barW / Math.max(count, 1);
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(x, {
      toValue: activeIndex * tabWidth,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }, [activeIndex, tabWidth, x]);

  const PILL_INSET = 6;
  return (
    <View
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
      style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius, overflow: 'hidden' }}
    >
      <BlurView tint="light" intensity={40} style={StyleSheet.absoluteFill}>
        {/* ~62% milky veil over the blur — the frosted look from the proof. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: card + '9e' }]} />
      </BlurView>
      {tabWidth > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 10,
            height: BAR_HEIGHT - 20,
            width: tabWidth - PILL_INSET * 2,
            left: PILL_INSET,
            borderRadius: 18,
            overflow: 'hidden',
            transform: [{ translateX: x }],
          }}
        >
          <LinearGradient
            colors={sheenGradient(tabTint)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors, eventInfo, variant } = useEventTheme();
  const { drinksBlocked } = useBlockedFeatures();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
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
    // Only react to the *transition* into `drinksBlocked === true`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinksBlocked]);

  const showRsvpTab = rsvpStatus === 'accepted_pending';
  const showDrinksTab = !drinksBlocked && eventInfo?.drink_game_enabled === true;
  const showPhotoGameTab = eventInfo?.photo_game_enabled === true;
  const showScheduleTab = (eventInfo?.schedule_stations?.length ?? 0) >= 2;
  const hasCover = !!eventInfo?.cover_image_url;

  const isSheet = variant.tabBar === 'sheet';
  const floatBottom = Math.max(insets.bottom, 10);

  // Ordered list of the tabs actually visible right now — the sliding indicator
  // needs the same order and count react-navigation lays out. Kept in sync with
  // the <Tabs.Screen> order + the same show* flags used for `href`.
  const visibleTabs = [
    'home',
    showScheduleTab && 'schedule',
    showRsvpTab && 'rsvp',
    'photos',
    showPhotoGameTab && 'photo-game',
    showDrinksTab && 'drinks',
    'settings',
  ].filter(Boolean) as string[];
  const currentTab = segments[segments.length - 1] ?? 'home';
  const activeIndex = Math.max(0, visibleTabs.indexOf(currentTab));

  // Soft-luxury: a floating, rounded frosted bar. `position:absolute` makes the
  // scene bleed full-height behind it (so the Home cover reaches the bottom) —
  // react-navigation still insets scroll screens via `useBottomTabBarHeight`.
  // An opaque backing colour lets iOS cast the float shadow; the frosted blur +
  // sliding pill (tabBarBackground) are painted on top. Classic stays docked.
  const tabBarStyle = isSheet
    ? {
        position: 'absolute' as const,
        left: BAR_MARGIN,
        right: BAR_MARGIN,
        bottom: floatBottom,
        height: BAR_HEIGHT,
        paddingTop: 8,
        paddingBottom: 10,
        borderRadius: variant.tabBarRadius,
        borderWidth: 1,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.45)',
        backgroundColor: colors.card,
        shadowColor: '#5a3238',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }
    : {
        backgroundColor: colors.screenBg,
        borderTopColor: colors.border + '33',
        borderTopWidth: 1,
      };

  const tabBarBackground = isSheet
    ? () => (
        <FrostedTabBackground
          activeIndex={activeIndex}
          count={visibleTabs.length}
          card={colors.card}
          tabTint={colors.tabTint}
          radius={variant.tabBarRadius}
        />
      )
    : undefined;

  // Soft-luxury: active icon + label ride on the maroon pill → white; inactive
  // are muted maroon on the frosted bar.
  const activeTint = isSheet ? colors.card : colors.tabTint;
  const inactiveTint = isSheet ? colors.tabTint + '99' : colors.tabTint + '66';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarStyle,
        tabBarBackground,
        tabBarLabelStyle: colors.fontFamily ? { fontFamily: colors.fontFamily.regular } : undefined,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          // Classic over a cover: transparent full-bleed bar with light tints.
          // Soft-luxury already floats, so it keeps the shared tints/style.
          tabBarActiveTintColor:
            hasCover && !isSheet ? (colors.homeText ?? colors.tabTint) : activeTint,
          tabBarInactiveTintColor:
            hasCover && !isSheet ? 'rgba(255,255,255,0.55)' : inactiveTint,
          tabBarStyle:
            hasCover && !isSheet
              ? {
                  position: 'absolute',
                  backgroundColor: 'transparent',
                  borderTopWidth: 0,
                  elevation: 0,
                  shadowOpacity: 0,
                }
              : tabBarStyle,
          tabBarIcon: ({ color, size }) => <TabBarIcon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('tabs.schedule'),
          href: showScheduleTab ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabBarIcon name="time-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rsvp"
        options={{
          title: t('tabs.rsvp'),
          href: showRsvpTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="checkmark-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t('tabs.photos'),
          tabBarIcon: ({ color, size }) => <TabBarIcon name="images-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="photo-game"
        options={{
          title: t('photoGame.tab'),
          href: showPhotoGameTab ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabBarIcon name="camera-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="drinks"
        options={{
          title: t('tabs.drinks'),
          href: showDrinksTab ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabBarIcon name="beer-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <TabBarIcon name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
