import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ScheduleTimeline } from '../../components/ScheduleTimeline';
import { ScreenGradient } from '../../components/ScreenGradient';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { fetchManagementSchedule } from '../../lib/managementSchedule';
import { queryClient } from '../../lib/queryClient';
import { qk } from '../../lib/queryKeys';
import { useSessionScope } from '../../lib/SessionContext';
import { useRefetchOnFocus } from '../../lib/useRefetchOnFocus';

export default function OrganizerScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const scope = useSessionScope();
  const [now, setNow] = useState(() => Date.now());

  // Read-only schedule as a cache-backed query (CP5).
  const scheduleQuery = useQuery(
    {
      queryKey: qk.managementSchedule(scope),
      queryFn: ({ signal }) => fetchManagementSchedule(signal),
      enabled: scope?.actor === 'management',
    },
    queryClient
  );
  const schedule = scheduleQuery.data ?? null;
  const loading = scheduleQuery.isLoading;
  const failed = scheduleQuery.isError;
  const refreshing = scheduleQuery.isRefetching;

  // Revalidate on focus only when stale (respects staleTime) — not on every
  // focus, which raced the initial fetch and caused a redundant refetch.
  useRefetchOnFocus(scheduleQuery);

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
            onRefresh={() => void scheduleQuery.refetch()}
            tintColor={colors.tabTint}
            colors={[colors.tabTint]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.tabTint} />
        ) : failed ? (
          <TouchableOpacity onPress={() => void scheduleQuery.refetch()}>
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
