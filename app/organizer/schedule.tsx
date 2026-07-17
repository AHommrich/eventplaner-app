import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScheduleTimeline } from '../../components/ScheduleTimeline';
import { ScreenGradient } from '../../components/ScreenGradient';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { fetchManagementSchedule, ManagementSchedule } from '../../lib/managementSchedule';

export default function OrganizerScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const [schedule, setSchedule] = useState<ManagementSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setSchedule(await fetchManagementSchedule());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, paddingTop: insets.top }}>
      {variant.key === 'soft-luxury' && (
        <ScreenGradient screenBg={colors.screenBg} primary={colors.primary} />
      )}
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.tabTint}
            colors={[colors.tabTint]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.tabTint} />
        ) : failed ? (
          <TouchableOpacity onPress={() => void load()}>
            <ThemedText style={{ color: colors.cardText }}>{t('common.loadFailed')}</ThemedText>
            <ThemedText style={{ color: colors.primary, textDecorationLine: 'underline' }}>
              {t('common.retry')}
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <ScheduleTimeline
            dateIso={schedule?.date ?? null}
            stations={schedule?.schedule_stations ?? []}
            now={now}
          />
        )}
      </ScrollView>
    </View>
  );
}
