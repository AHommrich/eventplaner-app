import { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';

type Drink = { id: number; name: string };
type MyStatItem = { drink_id: number; drink_name: string; count: number };
type EventTotalItem = { drink_id: number; drink_name: string; total: number };
type LeaderItem = { guest_id: number; firstname: string; lastname: string; count: number };
type LeaderboardEntry = { drink_id: number; drink_name: string; top: LeaderItem[] };
type Stats = {
  my_stats: MyStatItem[];
  event_totals: EventTotalItem[];
  leaderboard: LeaderboardEntry[];
};

export default function DrinksScreen() {
  const { t } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<'track' | 'stats'>('track');
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [myCounts, setMyCounts] = useState<Record<number, number>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [logging, setLogging] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadDrinks() {
    try {
      const [drinksRes, statsRes] = await Promise.all([
        api.get<{ data: Drink[] }>('/api/drinks'),
        api.get<Stats>('/api/drinks/stats'),
      ]);
      setDrinks(drinksRes.data.data);
      setStats(statsRes.data);
      const counts: Record<number, number> = {};
      statsRes.data.my_stats.forEach((s) => { counts[s.drink_id] = s.count; });
      setMyCounts(counts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await api.get<Stats>('/api/drinks/stats');
      setStats(res.data);
      const counts: Record<number, number> = {};
      res.data.my_stats.forEach((s) => { counts[s.drink_id] = s.count; });
      setMyCounts(counts);
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    loadDrinks();
  }, []));

  function handlePress(drink: Drink) {
    if (logging !== null) return;

    if (pending === drink.id) {
      // zweiter Tap — loggen
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(null);
      commitLog(drink);
    } else {
      // erster Tap — pending setzen, nach 2s zurücksetzen
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(drink.id);
      pendingTimer.current = setTimeout(() => setPending(null), 2000);
    }
  }

  async function commitLog(drink: Drink) {
    setLogging(drink.id);
    setMyCounts((prev) => ({ ...prev, [drink.id]: (prev[drink.id] ?? 0) + 1 }));
    try {
      await api.post('/api/drinks/log', { drink_id: drink.id });
    } catch {
      setMyCounts((prev) => ({ ...prev, [drink.id]: Math.max(0, (prev[drink.id] ?? 1) - 1) }));
    } finally {
      setLogging(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>

      {/* Toggle */}
      <View style={[styles.toggleRow, { borderColor: colors.primary }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'track' && { backgroundColor: colors.primary }]}
          onPress={() => setView('track')}
        >
          <Text style={[styles.toggleText, { color: view === 'track' ? '#fff' : colors.primary }]}>
            {t('drinks.trackTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'stats' && { backgroundColor: colors.primary }]}
          onPress={() => { setView('stats'); loadStats(); }}
        >
          <Text style={[styles.toggleText, { color: view === 'stats' ? '#fff' : colors.primary }]}>
            {t('drinks.statsTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Track View */}
      {view === 'track' && (
        <ScrollView contentContainerStyle={styles.trackContent}>
          {drinks.map((drink) => {
            const isPending = pending === drink.id;
            const isLogging = logging === drink.id;
            return (
              <TouchableOpacity
                key={drink.id}
                style={[
                  styles.drinkBtn,
                  { backgroundColor: isPending ? colors.primary : colors.primary },
                  isPending && styles.drinkBtnPending,
                ]}
                onPress={() => handlePress(drink)}
                disabled={logging !== null}
                activeOpacity={0.75}
              >
                <Text style={styles.drinkName}>{drink.name}</Text>
                <View style={styles.drinkRight}>
                  {isLogging
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {isPending ? '+?' : (myCounts[drink.id] ?? 0) > 0 ? `${myCounts[drink.id]}` : '+'}
                        </Text>
                      </View>
                    )
                  }
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Stats View */}
      {view === 'stats' && (
        <ScrollView contentContainerStyle={styles.statsContent}>
          {statsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : stats ? (
            <>
              <Text style={[styles.section, { color: colors.primary }]}>{t('drinks.myStats')}</Text>
              {stats.my_stats.length === 0
                ? <Text style={styles.empty}>{t('drinks.noData')}</Text>
                : stats.my_stats.map((s) => (
                  <View key={s.drink_id} style={styles.row}>
                    <Text style={[styles.rowName, { color: colors.primary }]}>{s.drink_name}</Text>
                    <Text style={[styles.rowCount, { color: colors.primary }]}>{s.count}×</Text>
                  </View>
                ))
              }

              <Text style={[styles.section, { color: colors.primary }]}>{t('drinks.eventTotal')}</Text>
              {stats.event_totals.map((s) => (
                <View key={s.drink_id} style={styles.row}>
                  <Text style={[styles.rowName, { color: colors.primary }]}>{s.drink_name}</Text>
                  <Text style={[styles.rowCount, { color: colors.primary }]}>{s.total}×</Text>
                </View>
              ))}

              <Text style={[styles.section, { color: colors.primary }]}>{t('drinks.leaderboard')}</Text>
              {stats.leaderboard.map((entry) => (
                <View key={entry.drink_id} style={styles.leaderBlock}>
                  <Text style={[styles.leaderDrink, { color: colors.primary }]}>{entry.drink_name}</Text>
                  {entry.top.map((g, i) => (
                    <View key={g.guest_id} style={styles.leaderRow}>
                      <Text style={styles.leaderRank}>#{i + 1}</Text>
                      <Text style={[styles.leaderName, { color: colors.primary }]}>
                        {g.firstname} {g.lastname}
                      </Text>
                      <Text style={[styles.leaderCount, { color: theme.colors.muted }]}>{g.count}×</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  toggleRow: {
    flexDirection: 'row',
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  toggleText: {
    fontWeight: '600',
    fontSize: 14,
  },

  trackContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  drinkBtn: {
    paddingVertical: 20,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  drinkBtnPending: {
    opacity: 0.8,
  },
  drinkName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  drinkRight: {
    width: 36,
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  statsContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  section: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowName: { fontSize: 15 },
  rowCount: { fontSize: 15, fontWeight: '600' },
  empty: {
    color: theme.colors.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },

  leaderBlock: { marginBottom: theme.spacing.sm },
  leaderDrink: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  leaderRank: { color: theme.colors.muted, fontSize: 13, width: 28 },
  leaderName: { flex: 1, fontSize: 14 },
  leaderCount: { fontSize: 14, fontWeight: '600' },
});
