import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshToast } from '../../components/RefreshToast';
import { ScheduleTimeline } from '../../components/ScheduleTimeline';
import { ScreenGradient } from '../../components/ScreenGradient';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useRefreshToast } from '../../lib/useRefreshToast';

export default function ScheduleScreen() {
  const { colors, eventInfo, variant, loadTheme } = useEventTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { refreshing, refreshed, onRefresh } = useRefreshToast(loadTheme);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isFocused]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, paddingTop: insets.top }}>
      {variant.key === 'soft-luxury' && (
        <ScreenGradient screenBg={colors.screenBg} primary={colors.primary} />
      )}
      <RefreshToast visible={refreshed} refreshing={refreshing} />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: tabBarHeight + theme.spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tabTint}
            colors={[colors.tabTint]}
          />
        }
      >
        <ScheduleTimeline
          dateIso={eventInfo?.date ?? null}
          stations={eventInfo?.schedule_stations ?? []}
          now={now}
        />
      </ScrollView>
    </View>
  );
}
