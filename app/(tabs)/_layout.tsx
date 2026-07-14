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
 * Conditional tabs are hidden with `href: null` (classic) and filtered out of
 * the custom bar via `hiddenTabs` (soft-luxury).
 *
 * Presets:
 *   - classic ....... the default docked hairline bar (`tabBarIcon` per screen).
 *   - soft-luxury ... a fully custom floating, frosted rounded bar (`SoftTabBar`
 *                     via the `tabBar` prop). A single highlight circle SLIDES
 *                     horizontally to the active tab (spring) and stays perfectly
 *                     concentric with the icon because the bar owns both layouts.
 *                     Over the Home cover the circle is a white ring on a
 *                     see-through frost; elsewhere a maroon gradient disc.
 */
import { ComponentProps, useEffect, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { sheenGradient } from '../../lib/variantStyles';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useBlockedFeatures } from '../../lib/BlockedFeaturesContext';
import { fetchGuestMe, RsvpStatus } from '../../lib/guest';
import { haptics } from '../../lib/haptics';

const BAR_HEIGHT = 66;
const BAR_MARGIN = 14;
const BAR_PAD_H = 6;
const BAR_PAD_TOP = 8;
const CIRCLE = 34;

const TAB_ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  home: 'home-outline',
  schedule: 'time-outline',
  rsvp: 'checkmark-circle-outline',
  photos: 'images-outline',
  'photo-game': 'camera-outline',
  drinks: 'beer-outline',
  settings: 'settings-outline',
};

/** Plain icon for the classic preset (soft-luxury renders via SoftTabBar). */
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
 * Soft-luxury custom tab bar. Owns the full layout, so the highlight circle can
 * both slide (spring on translateX driven by the active index) AND sit exactly
 * concentric with the icon (icon slot and circle share the same top). The photo
 * shows through when Home is active (`overCover`).
 */
function SoftTabBar({
  state,
  navigation,
  descriptors,
  hiddenTabs,
  colors,
  radius,
  floatBottom,
  overCover,
  fontFamily,
}: BottomTabBarProps & {
  hiddenTabs: Set<string>;
  colors: ReturnType<typeof useEventTheme>['colors'];
  radius: number;
  floatBottom: number;
  overCover: boolean;
  fontFamily?: string;
}) {
  const routes = state.routes.filter((r) => !hiddenTabs.has(r.name));
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    0,
    routes.findIndex((r) => r.name === activeName)
  );

  const [rowW, setRowW] = useState(0);
  // Items are flex:1 INSIDE the row's horizontal padding, so the per-tab stride
  // is the padded content width / count — using the full rowW would make the
  // stride a touch too wide and the circle would drift right with each tab.
  const itemW = rowW > 0 ? (rowW - BAR_PAD_H * 2) / routes.length : 0;
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (itemW > 0) {
      Animated.spring(x, {
        toValue: activeIndex * itemW,
        useNativeDriver: true,
        friction: 9,
        tension: 90,
      }).start();
    }
  }, [activeIndex, itemW, x]);

  const label = (name: string) => {
    const title = descriptors[routes.find((r) => r.name === name)!.key]?.options.title;
    return typeof title === 'string' ? title : name;
  };
  const iconColor = (focused: boolean) => {
    if (overCover) return focused ? '#ffffff' : 'rgba(255,255,255,0.6)';
    return focused ? colors.card : colors.tabTint + '99';
  };
  const labelColor = (focused: boolean) => {
    if (overCover) return focused ? '#ffffff' : 'rgba(255,255,255,0.6)';
    return focused ? colors.tabTint : colors.tabTint + '99';
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: BAR_MARGIN,
        right: BAR_MARGIN,
        bottom: floatBottom,
        height: BAR_HEIGHT,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: overCover ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
        backgroundColor: overCover ? 'transparent' : colors.card,
        shadowColor: '#5a3238',
        shadowOpacity: overCover ? 0 : 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: overCover ? 0 : 12,
      }}
    >
      {/* Frosted glass fill, clipped to the rounded shape. */}
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius, overflow: 'hidden' }}>
        <BlurView tint="light" intensity={overCover ? 22 : 40} style={StyleSheet.absoluteFill}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.card + (overCover ? '33' : '9e') },
            ]}
          />
        </BlurView>
      </View>

      {/* Tab row + the single sliding highlight circle. */}
      <View
        onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
        style={{
          flex: 1,
          flexDirection: 'row',
          paddingHorizontal: BAR_PAD_H,
          paddingTop: BAR_PAD_TOP,
        }}
      >
        {itemW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: BAR_PAD_TOP,
              left: BAR_PAD_H + (itemW - CIRCLE) / 2,
              width: CIRCLE,
              height: CIRCLE,
              borderRadius: CIRCLE / 2,
              overflow: 'hidden',
              transform: [{ translateX: x }],
              ...(overCover
                ? {
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.9)',
                    backgroundColor: 'rgba(255,255,255,0.18)',
                  }
                : {
                    shadowColor: colors.tabTint,
                    shadowOpacity: 0.45,
                    shadowRadius: 7,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 6,
                  }),
            }}
          >
            {!overCover && (
              <LinearGradient
                colors={sheenGradient(colors.tabTint)}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
          </Animated.View>
        )}

        {routes.map((route) => {
          const focused = route.name === activeName;
          const onPress = () => {
            haptics.selection();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={{ flex: 1, alignItems: 'center' }}
            >
              {/* Icon slot: same top + height as the circle → always concentric. */}
              <View style={{ height: CIRCLE, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={TAB_ICONS[route.name] ?? 'ellipse-outline'}
                  size={20}
                  color={iconColor(focused)}
                />
              </View>
              <Text
                numberOfLines={1}
                style={{ fontSize: 10, marginTop: 2, color: labelColor(focused), fontFamily }}
              >
                {label(route.name)}
              </Text>
            </Pressable>
          );
        })}
      </View>
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

  const currentTab = segments[segments.length - 1] ?? 'home';
  const overCover = isSheet && hasCover && (currentTab === 'home' || currentTab === '(tabs)');

  // Routes the soft-luxury bar must NOT render (mirror of the classic href flags).
  const hiddenTabs = new Set<string>();
  if (!showScheduleTab) hiddenTabs.add('schedule');
  if (!showRsvpTab) hiddenTabs.add('rsvp');
  if (!showPhotoGameTab) hiddenTabs.add('photo-game');
  if (!showDrinksTab) hiddenTabs.add('drinks');

  // Classic docked bar style (soft-luxury renders its own bar in SoftTabBar).
  const classicTabBarStyle = {
    backgroundColor: colors.screenBg,
    borderTopColor: colors.border + '33',
    borderTopWidth: 1,
  };

  return (
    <Tabs
      // Soft-luxury swaps in a fully custom frosted bar with a sliding circle;
      // classic keeps the default docked bar. Haptic tick handled inside
      // SoftTabBar (soft) and via screenListeners (classic).
      tabBar={
        isSheet
          ? (props) => (
              <SoftTabBar
                {...props}
                hiddenTabs={hiddenTabs}
                colors={colors}
                radius={variant.tabBarRadius}
                floatBottom={floatBottom}
                overCover={overCover}
                fontFamily={colors.fontFamily?.regular}
              />
            )
          : undefined
      }
      screenListeners={isSheet ? undefined : { tabPress: () => haptics.selection() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabTint,
        tabBarInactiveTintColor: colors.tabTint + '66',
        tabBarStyle: classicTabBarStyle,
        tabBarLabelStyle: colors.fontFamily ? { fontFamily: colors.fontFamily.regular } : undefined,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          // Classic over a cover: transparent full-bleed bar with light tints.
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
            <TabBarIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('tabs.schedule'),
          href: showScheduleTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="time-outline" color={color} size={size} />
          ),
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
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="images-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="photo-game"
        options={{
          title: t('photoGame.tab'),
          href: showPhotoGameTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="camera-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="drinks"
        options={{
          title: t('tabs.drinks'),
          href: showDrinksTab ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="beer-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
