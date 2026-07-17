import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventTheme } from '../lib/EventThemeContext';
import { haptics } from '../lib/haptics';
import { sheenGradient } from '../lib/variantStyles';

const BAR_HEIGHT = 66;
const BAR_MARGIN = 14;
const BAR_PAD_H = 6;
const BAR_PAD_TOP = 8;
const CIRCLE = 34;

export type EventTabIconName = ComponentProps<typeof Ionicons>['name'];
export type EventTabIconMap = Readonly<Record<string, EventTabIconName>>;

export function EventTabIcon({
  name,
  color,
  size,
}: {
  name: EventTabIconName;
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function EventTabBar({
  state,
  navigation,
  descriptors,
  hiddenTabs,
  icons,
  colors,
  radius,
  floatBottom,
  overCover,
  fontFamily,
}: BottomTabBarProps & {
  hiddenTabs: ReadonlySet<string>;
  icons: EventTabIconMap;
  colors: ReturnType<typeof useEventTheme>['colors'];
  radius: number;
  floatBottom: number;
  overCover: boolean;
  fontFamily?: string;
}) {
  const routes = state.routes.filter((route) => !hiddenTabs.has(route.name));
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    0,
    routes.findIndex((route) => route.name === activeName)
  );
  const [rowWidth, setRowWidth] = useState(0);
  const itemWidth = rowWidth > 0 ? (rowWidth - BAR_PAD_H * 2) / routes.length : 0;
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (itemWidth > 0) {
      Animated.spring(translateX, {
        toValue: activeIndex * itemWidth,
        useNativeDriver: true,
        friction: 9,
        tension: 90,
      }).start();
    }
  }, [activeIndex, itemWidth, translateX]);

  function label(name: string): string {
    const route = routes.find((candidate) => candidate.name === name);
    const title = route ? descriptors[route.key]?.options.title : undefined;
    return typeof title === 'string' ? title : name;
  }

  function iconColor(focused: boolean): string {
    if (overCover) return focused ? '#ffffff' : 'rgba(255,255,255,0.6)';
    return focused ? colors.navBg : colors.tabTint + '99';
  }

  function labelColor(focused: boolean): string {
    if (overCover) return focused ? '#ffffff' : 'rgba(255,255,255,0.6)';
    return focused ? colors.tabTint : colors.tabTint + '99';
  }

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
        backgroundColor: overCover ? 'transparent' : colors.navBg,
        shadowColor: '#5a3238',
        shadowOpacity: overCover ? 0 : 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: overCover ? 0 : 12,
      }}
    >
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius, overflow: 'hidden' }}>
        {overCover ? (
          <BlurView tint="light" intensity={22} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navBg + '33' }]} />
          </BlurView>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navBg }]} />
        )}
      </View>

      <View
        onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
        style={{
          flex: 1,
          flexDirection: 'row',
          paddingHorizontal: BAR_PAD_H,
          paddingTop: BAR_PAD_TOP,
        }}
      >
        {itemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: BAR_PAD_TOP,
              left: BAR_PAD_H + (itemWidth - CIRCLE) / 2,
              width: CIRCLE,
              height: CIRCLE,
              borderRadius: CIRCLE / 2,
              overflow: 'hidden',
              transform: [{ translateX }],
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
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                haptics.selection();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <View style={{ height: CIRCLE, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={icons[route.name] ?? 'ellipse-outline'}
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

export function EventTabShell({
  children,
  icons,
  hiddenTabs = new Set<string>(),
  overCover = false,
  classicTabBarStyle,
}: {
  children: ReactNode;
  icons: EventTabIconMap;
  hiddenTabs?: ReadonlySet<string>;
  overCover?: boolean;
  classicTabBarStyle?: StyleProp<ViewStyle>;
}) {
  const { colors, variant } = useEventTheme();
  const insets = useSafeAreaInsets();
  const isSheet = variant.tabBar === 'sheet';
  const defaultClassicStyle = {
    backgroundColor: colors.navBg,
    borderTopColor: colors.border + '33',
    borderTopWidth: 1,
  };

  return (
    <Tabs
      tabBar={
        isSheet
          ? (props) => (
              <EventTabBar
                {...props}
                hiddenTabs={hiddenTabs}
                icons={icons}
                colors={colors}
                radius={variant.tabBarRadius}
                floatBottom={Math.max(insets.bottom, 10)}
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
        tabBarStyle: classicTabBarStyle ?? defaultClassicStyle,
        tabBarLabelStyle: colors.fontFamily ? { fontFamily: colors.fontFamily.regular } : undefined,
      }}
    >
      {children}
    </Tabs>
  );
}
