import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { cardSurfaceStyle } from '../../lib/variantStyles';
import {
  ensureActiveManagementEvent,
  fetchManagementEvents,
  getManagementSession,
  ManagementEvent,
  ManagementSession,
} from '../../lib/management';
import {
  getManagementPushEnabled,
  setManagementPushEnabled,
  syncManagementPushPreference,
} from '../../lib/managementPush';

export default function OrganizerHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const [session, setSession] = useState<ManagementSession | null>(null);
  const [events, setEvents] = useState<ManagementEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);

  const load = useCallback(async () => {
    const current = await getManagementSession();
    if (!current) {
      router.replace('/');
      return;
    }
    setSession(current);
    const currentPushEnabled = await getManagementPushEnabled();
    setPushEnabled(currentPushEnabled);
    if (currentPushEnabled) {
      void syncManagementPushPreference()
        .then(setPushEnabled)
        .catch(() => {
          // Keep the preference and retry on the next organizer focus.
        });
    }
    try {
      const accessible = await fetchManagementEvents();
      setEvents(accessible);
      await ensureActiveManagementEvent(accessible);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function togglePush(enabled: boolean) {
    setPushSaving(true);
    try {
      setPushEnabled(await setManagementPushEnabled(enabled));
    } catch {
      Alert.alert(t('common.error'), t('organizer.pushUpdateFailed'));
    } finally {
      setPushSaving(false);
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.screenBg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.md, gap: variant.gap },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <ThemedText style={[styles.eyebrow, { color: colors.tabTint }]}>
            {t('organizer.area')}
          </ThemedText>
          <ThemedText style={[styles.title, { color: colors.cardText }]}>
            {session?.name ?? t('organizer.title')}
          </ThemedText>
          <ThemedText style={styles.email}>{session?.email}</ThemedText>
        </View>
      </View>

      <View
        style={[styles.card, cardSurfaceStyle(variant, colors.card, colors.border), styles.pushRow]}
      >
        <View style={styles.pushText}>
          <ThemedText style={[styles.cardTitleCompact, { color: colors.cardText }]}>
            {t('organizer.pushTitle')}
          </ThemedText>
          <ThemedText style={styles.pushHint}>{t('organizer.pushHint')}</ThemedText>
        </View>
        <Switch
          accessibilityLabel={t('organizer.pushTitle')}
          value={pushEnabled}
          disabled={pushSaving}
          onValueChange={(enabled) => void togglePush(enabled)}
        />
      </View>

      <View style={[styles.card, cardSurfaceStyle(variant, colors.card, colors.border)]}>
        <ThemedText style={[styles.cardTitle, { color: colors.cardText }]}>
          {t('organizer.chooseEvent')}
        </ThemedText>
        {loading ? (
          <ActivityIndicator color={colors.cardText} />
        ) : failed ? (
          <TouchableOpacity onPress={() => void load()}>
            <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
            <ThemedText style={styles.retry}>{t('common.retry')}</ThemedText>
          </TouchableOpacity>
        ) : events.length === 0 ? (
          <ThemedText style={styles.empty}>{t('organizer.noEvents')}</ThemedText>
        ) : (
          <View style={[styles.eventRow, { borderColor: colors.border }]}>
            <View style={styles.eventText}>
              <ThemedText style={[styles.eventName, { color: colors.cardText }]}>
                {events[0].name}
              </ThemedText>
              <ThemedText style={styles.role}>
                {t(`organizer.roles.${events[0].my_role}`)}
              </ThemedText>
            </View>
            <Ionicons name="lock-closed-outline" size={20} color={colors.tabTint} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: { fontSize: 26, fontWeight: '700' },
  email: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  card: {
    padding: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  cardTitleCompact: { fontSize: 17, fontWeight: '700' },
  pushRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  pushText: { flex: 1 },
  pushHint: { color: theme.colors.muted, fontSize: 13, marginTop: theme.spacing.xs },
  eventRow: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventText: { flex: 1 },
  eventName: { fontWeight: '600' },
  role: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  empty: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  retry: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    marginTop: theme.spacing.xs,
  },
});
