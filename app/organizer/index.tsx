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
import {
  clearManagementSession,
  ensureActiveManagementEvent,
  fetchManagementEvents,
  getManagementSession,
  ManagementEvent,
  ManagementSession,
  setActiveManagementEvent,
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
  const [session, setSession] = useState<ManagementSession | null>(null);
  const [events, setEvents] = useState<ManagementEvent[]>([]);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
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
      setActiveEventId(await ensureActiveManagementEvent(accessible));
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

  async function selectEvent(eventId: number) {
    await setActiveManagementEvent(eventId);
    setActiveEventId(eventId);
  }

  async function logout() {
    await clearManagementSession();
    router.replace('/');
  }

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
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.md }]}
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
          <ThemedText style={styles.eyebrow}>{t('organizer.area')}</ThemedText>
          <ThemedText style={styles.title}>{session?.name ?? t('organizer.title')}</ThemedText>
          <ThemedText style={styles.email}>{session?.email}</ThemedText>
        </View>
        <TouchableOpacity accessibilityLabel={t('settings.logout')} onPress={logout}>
          <Ionicons name="log-out-outline" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.card, styles.pushRow]}>
        <View style={styles.pushText}>
          <ThemedText style={styles.cardTitleCompact}>{t('organizer.pushTitle')}</ThemedText>
          <ThemedText style={styles.pushHint}>{t('organizer.pushHint')}</ThemedText>
        </View>
        <Switch
          accessibilityLabel={t('organizer.pushTitle')}
          value={pushEnabled}
          disabled={pushSaving}
          onValueChange={(enabled) => void togglePush(enabled)}
        />
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>{t('organizer.chooseEvent')}</ThemedText>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : failed ? (
          <TouchableOpacity onPress={() => void load()}>
            <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
            <ThemedText style={styles.retry}>{t('common.retry')}</ThemedText>
          </TouchableOpacity>
        ) : events.length === 0 ? (
          <ThemedText style={styles.empty}>{t('organizer.noEvents')}</ThemedText>
        ) : (
          events.map((event) => {
            const active = event.id === activeEventId;
            return (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventRow, active && styles.eventRowActive]}
                onPress={() => void selectEvent(event.id)}
              >
                <View style={styles.eventText}>
                  <ThemedText style={[styles.eventName, active && styles.eventNameActive]}>
                    {event.name}
                  </ThemedText>
                  <ThemedText style={[styles.role, active && styles.roleActive]}>
                    {t(`organizer.roles.${event.my_role}`)}
                  </ThemedText>
                </View>
                {active && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.secondary} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>{t('organizer.tools')}</ThemedText>
        <ThemedText style={styles.comingSoon}>{t('organizer.toolsHint')}</ThemedText>
        <TouchableOpacity
          style={[styles.toolButton, activeEventId === null && styles.toolButtonDisabled]}
          onPress={() => router.push('/organizer/notes')}
          disabled={activeEventId === null}
        >
          <Ionicons name="checkbox-outline" size={22} color={theme.colors.secondary} />
          <ThemedText style={styles.toolButtonText}>{t('organizer.notesButton')}</ThemedText>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolButton, activeEventId === null && styles.toolButtonDisabled]}
          onPress={() => router.push('/organizer/photos')}
          disabled={activeEventId === null}
        >
          <Ionicons name="images-outline" size={22} color={theme.colors.secondary} />
          <ThemedText style={styles.toolButtonText}>{t('organizer.photosButton')}</ThemedText>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.secondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: { color: theme.colors.primary, fontSize: 26, fontWeight: '700' },
  email: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  cardTitleCompact: { color: theme.colors.primary, fontSize: 17, fontWeight: '700' },
  pushRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  pushText: { flex: 1 },
  pushHint: { color: theme.colors.muted, fontSize: 13, marginTop: theme.spacing.xs },
  eventRow: {
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventRowActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  eventText: { flex: 1 },
  eventName: { color: theme.colors.primary, fontWeight: '600' },
  eventNameActive: { color: theme.colors.secondary },
  role: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  roleActive: { color: theme.colors.secondary },
  empty: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  retry: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    marginTop: theme.spacing.xs,
  },
  comingSoon: { color: theme.colors.muted, marginBottom: theme.spacing.md },
  toolButton: {
    minHeight: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  toolButtonDisabled: { opacity: 0.45 },
  toolButtonText: { flex: 1, color: theme.colors.secondary, fontWeight: '700' },
});
