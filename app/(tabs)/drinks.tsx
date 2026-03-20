import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TouchableOpacity, ScrollView, RefreshControl,
  ActivityIndicator, StyleSheet, Pressable, TextInput,
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { getSession, GuestSession } from '../../lib/auth';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { theme } from '../../constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

type Drink = {
  id: number;
  display_name: string;
  category: string;
  category_label: string;
  is_alcoholic: boolean;
  amount_liter: number;
  points: number;
};

type LogResponse = {
  drink_id: number;
  display_name: string;
  total: number;
  base_points: number;
  final_points: number;
  binge_penalty: boolean;
};

type GuestTotal = {
  guest_id: number;
  firstname: string;
  lastname: string;
  total: number;
  points_total: number;
};

type MyStatItem = {
  drink_id: number;
  display_name: string;
  points_each: number;
  count: number;
  points_total: number;
};

type Stats = {
  guest_totals: GuestTotal[];
  my_stats: MyStatItem[];
  current_streak: number;
  binge_penalty: boolean;
  cooldown_seconds: number;
};

type ToastData = { points: number; bingePenalty: boolean };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEndTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#C9A84C', '#A8A9AD', '#CD7F32'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrinksScreen() {
  const { t } = useLanguage();
  const { colors, eventInfo, loadTheme } = useEventTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [view, setView] = useState<'log' | 'leaderboard'>('log');
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [selected, setSelected] = useState<Drink | null>(null);
  const [logging, setLogging] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [myStatsExpanded, setMyStatsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GuestSession | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { refreshing, refreshed, onRefresh } = useRefreshToast(async () => { await loadStats(); loadTheme(); });

  // ── Session ────────────────────────────────────────────────────────────────

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  // ── Game-end check ─────────────────────────────────────────────────────────

  const endTime = eventInfo?.drink_game_end_time ?? null;

  useEffect(() => {
    if (!endTime) return;
    const check = () => setGameEnded(new Date(endTime).getTime() <= Date.now());
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [endTime]);

  // ── Cooldown countdown ─────────────────────────────────────────────────────

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, Math.ceil(c) - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Leaderboard polling ────────────────────────────────────────────────────

  useEffect(() => {
    if (view !== 'leaderboard') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(loadStats, 5_000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [view]);

  // ── Initial load on focus ──────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    loadInitial();
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []));

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadInitial() {
    setLoading(true);
    try {
      const [drinksRes, statsRes] = await Promise.all([
        api.get<{ data: Drink[] }>('/api/drinks'),
        api.get<Stats>('/api/drinks/stats'),
      ]);
      setDrinks(drinksRes.data.data);
      applyStats(statsRes.data);
    } catch {
      // Fehler vom Interceptor behandelt
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await api.get<Stats>('/api/drinks/stats');
      applyStats(res.data);
    } catch {
      // silent
    }
  }

  function applyStats(data: Stats) {
    setStats(data);
  }

  // ── Log drink ──────────────────────────────────────────────────────────────

  async function handleLog(drink: Drink) {
    if (logging || cooldown > 0 || gameEnded) return;
    setLogging(true);
    try {
      const res = await api.post<LogResponse>('/api/drinks/log', { drink_id: drink.id });
      const data = res.data;
      setCooldown(60);
      showToast({ points: data.final_points, bingePenalty: data.binge_penalty });
      setSelected(null);
      setSelectedGroup(null);
      loadStats();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'cooldown') {
        setCooldown(Math.ceil(e.response.data.retry_after ?? 60));
      } else if (code === 'game_ended') {
        setGameEnded(true);
      }
      // drinks_blocked: global vom Interceptor behandelt
    } finally {
      setLogging(false);
    }
  }

  function showToast(data: ToastData) {
    setToast(data);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Drink grouping helpers ─────────────────────────────────────────────────

  function extractBaseName(displayName: string): string {
    return displayName.replace(/\s+\d[\d,.]*\s*(?:l|cl|ml)$/i, '').trim() || displayName;
  }

  function formatSize(amountLiter: number): string {
    if (amountLiter < 0.1) return `${Math.round(amountLiter * 100)} cl`;
    const str = amountLiter.toFixed(2).replace('.', ',').replace(/0+$/, '').replace(/,$/, '');
    return `${str} l`;
  }

  type DrinkGroup = { baseName: string; drinks: Drink[] };

  function buildGroups(drinkList: Drink[]): DrinkGroup[] {
    const order: string[] = [];
    const map: Record<string, DrinkGroup> = {};
    for (const drink of drinkList) {
      const baseName = extractBaseName(drink.display_name);
      if (!map[baseName]) { order.push(baseName); map[baseName] = { baseName, drinks: [] }; }
      map[baseName].drinks.push(drink);
    }
    return order.map((k) => map[k]);
  }

  // ── Drink row renderer ─────────────────────────────────────────────────────

  function renderGroup(group: DrinkGroup) {
    const { baseName, drinks: gDrinks } = group;
    const isMulti = gDrinks.length > 1;
    const disabled = gameEnded || cooldown > 0;

    if (isMulti) {
      const isExpanded = selectedGroup === baseName;
      return (
        <TouchableOpacity
          key={baseName}
          style={[
            styles.drinkRow,
            { borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
            isExpanded && { backgroundColor: colors.primary + '08' },
            disabled && !isExpanded && { opacity: 0.45 },
          ]}
          onPress={() => {
            if (disabled) return;
            setSelected(null);
            setSelectedGroup(isExpanded ? null : baseName);
          }}
          activeOpacity={0.75}
          disabled={disabled && !isExpanded}
        >
          {isExpanded ? (
            <View style={styles.sizeButtonRow}>
              {gDrinks.map((drink) => (
                <TouchableOpacity
                  key={drink.id}
                  style={[styles.sizeButton, { backgroundColor: colors.cardButton, borderWidth: 1.5, borderColor: colors.cardButton, borderRadius: theme.borderRadius.lg - theme.spacing.xs }]}
                  onPress={() => handleLog(drink)}
                  disabled={logging}
                  activeOpacity={0.8}
                >
                  {logging
                    ? <ActivityIndicator color={colors.cardButtonText} size="small" />
                    : <ThemedText style={[styles.sizeButtonText, { color: colors.cardButtonText }]}>{formatSize(drink.amount_liter)}?</ThemedText>
                  }
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              <ThemedText style={[styles.drinkName, { color: colors.cardText }]}>{baseName}</ThemedText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                {gDrinks.map((d) => {
                  const pos = d.points >= 0;
                  return (
                    <View key={d.id} style={[styles.pointsBadge, { backgroundColor: pos ? colors.primary + '18' : '#00000010' }]}>
                      <ThemedText style={[styles.pointsText, { color: colors.cardText }]}>
                        {pos ? `+${d.points}` : `${d.points}`}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </TouchableOpacity>
      );
    }

    // Single size
    const drink = gDrinks[0];
    const isSelected = selected?.id === drink.id;
    const positive = drink.points >= 0;
    return (
      <TouchableOpacity
        key={drink.id}
        style={[
          styles.drinkRow,
          { borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
          disabled && !isSelected && { opacity: 0.45 },
        ]}
        onPress={() => {
          setSelectedGroup(null);
          isSelected ? handleLog(drink) : setSelected(drink);
        }}
        activeOpacity={0.75}
        disabled={disabled && !isSelected}
      >
        {isSelected ? (
          <View style={styles.sizeButtonRow}>
            <TouchableOpacity
              style={[styles.sizeButton, { backgroundColor: colors.cardButton, borderWidth: 1.5, borderColor: colors.cardButton, borderRadius: theme.borderRadius.lg - theme.spacing.xs }]}
              onPress={() => handleLog(drink)}
              disabled={logging}
              activeOpacity={0.8}
            >
              {logging
                ? <ActivityIndicator color={colors.cardButtonText} size="small" />
                : <ThemedText style={[styles.sizeButtonText, { color: colors.cardButtonText }]}>+1?</ThemedText>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ThemedText style={[styles.drinkName, { color: colors.cardText }]}>{baseName}</ThemedText>
            <View style={[styles.pointsBadge, { backgroundColor: positive ? colors.primary + '18' : '#00000010' }]}>
              <ThemedText style={[styles.pointsText, { color: colors.cardText }]}>
                {positive ? `+${drink.points}` : `${drink.points}`}
              </ThemedText>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && drinks.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.screenBg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.tabTint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg, paddingTop: insets.top }]}>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.cardButton, borderWidth: 2, borderColor: colors.border + '33', borderRadius: theme.borderRadius.lg - theme.spacing.xs, top: insets.top + theme.spacing.sm }]}>
          <ThemedText style={[styles.toastPoints, { color: colors.cardButtonText }]}>
            {toast.points >= 0
              ? t('drinks.pointsEarned', { points: toast.points })
              : t('drinks.pointsNeutral', { points: toast.points })}
          </ThemedText>
          {toast.bingePenalty && (
            <ThemedText style={[styles.toastBinge, { color: colors.cardButtonText + 'cc' }]}>{t('drinks.bingeToast')}</ThemedText>
          )}
        </View>
      )}

      {!toast && <RefreshToast visible={refreshed} refreshing={refreshing} />}

      {/* ── Card 1: Toggle + Streak/GameEnd ── */}
      <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, overflow: 'hidden' }}>

        {/* Toggle */}
        <View style={{ flexDirection: 'row', margin: theme.spacing.xs, borderRadius: theme.borderRadius.lg - theme.spacing.xs, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.cardText + '40' }}>
          <TouchableOpacity
            style={[styles.toggleBtn, {
              backgroundColor: view === 'log' ? colors.cardButton : 'transparent',
              borderRightWidth: 1,
              borderRightColor: colors.cardText + '40',
            }]}
            onPress={() => setView('log')}
          >
            <ThemedText style={[styles.toggleText, { color: view === 'log' ? colors.cardButtonText : colors.cardText }]}>
              {t('drinks.logTab')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, {
              backgroundColor: view === 'leaderboard' ? colors.cardButton : 'transparent',
            }]}
            onPress={() => { setView('leaderboard'); loadStats(); }}
          >
            <ThemedText style={[styles.toggleText, { color: view === 'leaderboard' ? colors.cardButtonText : colors.cardText }]}>
              {t('drinks.leaderboardTab')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Streak / Penalty */}
        {view === 'log' && stats && (stats.current_streak > 0 || stats.binge_penalty) && (
          <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardText + '20' }}>
            {stats.current_streak > 0 && (
              <ThemedText style={[styles.bannerText, { color: colors.cardText }]}>
                {t('drinks.streak', { n: stats.current_streak })}
                {stats.current_streak >= 2 && !stats.binge_penalty && (
                  <ThemedText style={styles.bannerSub}>
                    {'  '}{t('drinks.streakWarning', { n: 3 - stats.current_streak })}
                  </ThemedText>
                )}
              </ThemedText>
            )}
            {stats.binge_penalty && (
              <ThemedText style={[styles.bannerWarn, { color: colors.cardText }]}>
                {t('drinks.bingeActive')}
              </ThemedText>
            )}
          </View>
        )}

        {/* Game End */}
        {view === 'log' && endTime && (
          <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardText + '20', backgroundColor: gameEnded ? theme.colors.error + '22' : colors.primary + '18' }}>
            <ThemedText style={[styles.gameEndText, { color: gameEnded ? theme.colors.error : colors.cardText }]}>
              {gameEnded ? t('drinks.gameEnded') : t('drinks.endsAt', { time: formatEndTime(endTime) })}
            </ThemedText>
          </View>
        )}
      </View>

      {/* ── LOG VIEW ── */}
      {view === 'log' && (
        <View style={[styles.flex, { marginTop: theme.spacing.md }]}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tabTint} colors={[colors.tabTint]} />}>

            {/* Card 2: Suche + Getränkeliste */}
            <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', overflow: 'hidden' }}>

              {/* Suche */}
              <View style={[styles.searchRow, { borderBottomWidth: 1, borderBottomColor: colors.border + '30' }]}>
                <Ionicons name="search-outline" size={16} color={colors.cardText} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.cardText }]}
                  placeholder={t('drinks.searchPlaceholder')}
                  placeholderTextColor={colors.cardText + 'aa'}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Drink List — Suche oder Akkordeon */}
              {search.trim().length > 0 ? (
                (() => {
                  const q = search.trim().toLowerCase();
                  const results = drinks.filter((d) =>
                    d.display_name.toLowerCase().includes(q) ||
                    d.category_label.toLowerCase().includes(q)
                  );
                  if (results.length === 0) {
                    return (
                      <ThemedText style={[styles.emptyText, { color: theme.colors.muted }]}>
                        {t('drinks.searchNoResults')}
                      </ThemedText>
                    );
                  }
                  return buildGroups(results).map(renderGroup);
                })()
              ) : (
                (() => {
                  const categoryOrder: string[] = [];
                  const categoryMap: Record<string, { label: string; drinks: Drink[] }> = {};
                  for (const drink of drinks) {
                    if (!categoryMap[drink.category]) {
                      categoryOrder.push(drink.category);
                      categoryMap[drink.category] = { label: drink.category_label, drinks: [] };
                    }
                    categoryMap[drink.category].drinks.push(drink);
                  }
                  return categoryOrder.map((cat) => {
                    const { label, drinks: catDrinks } = categoryMap[cat];
                    const isOpen = expandedCategories.has(cat);
                    return (
                      <View key={cat}>
                        <TouchableOpacity
                          style={[styles.categoryRow, { borderBottomWidth: 1, borderBottomColor: colors.border + '30' }]}
                          onPress={() => {
                            setExpandedCategories((prev) => {
                              const next = new Set(prev);
                              next.has(cat) ? next.delete(cat) : next.add(cat);
                              return next;
                            });
                            if (selected && catDrinks.some((d) => d.id === selected.id)) setSelected(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.categoryHeader, { color: colors.cardText }]}>{label}</ThemedText>
                          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.cardText} />
                        </TouchableOpacity>
                        {isOpen && (
                          <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary + '50' }}>
                            {buildGroups(catDrinks).map(renderGroup)}
                          </View>
                        )}
                      </View>
                    );
                  });
                })()
              )}
            </View>

          </ScrollView>

          {/* Cooldown direkt über der Navbar */}
          {cooldown > 0 && (
            <View style={[styles.bottomAction, { backgroundColor: colors.cardButton, borderWidth: 2, borderColor: colors.border + '33', borderRadius: theme.borderRadius.lg - theme.spacing.xs, marginBottom: theme.spacing.sm, marginHorizontal: theme.spacing.lg }]}>
              <Ionicons name="time-outline" size={18} color={colors.cardButtonText} />
              <ThemedText style={[styles.cooldownText, { color: colors.cardButtonText }]}>
                {t('drinks.cooldown', { s: cooldown })}
              </ThemedText>
            </View>
          )}

        </View>
      )}


      {/* ── LEADERBOARD VIEW ── */}
      {view === 'leaderboard' && (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.xxl }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tabTint} colors={[colors.tabTint]} />}>

          {/* Rangliste */}
          <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', padding: theme.spacing.md }}>
          {stats?.guest_totals && stats.guest_totals.length > 0 ? (
            <>
              {/* Header */}
              <View style={styles.tableHeader}>
                <ThemedText style={[styles.tableHeaderCell, { width: 40, color: colors.cardText }]}>{t('drinks.rank')}</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { flex: 1, color: colors.cardText }]}>Name</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 52, textAlign: 'right', color: colors.cardText }]}>🍺</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 64, textAlign: 'right', color: colors.cardText }]}>Pts</ThemedText>
              </View>

              {stats.guest_totals.map((g, i) => {
                const isMe = g.guest_id === session?.guestId;
                const medal = MEDAL[i];
                const medalColor = MEDAL_COLORS[i];
                return (
                  <View
                    key={g.guest_id}
                    style={[
                      styles.tableRow,
                      isMe && { backgroundColor: colors.primary + '15' },
                      i < 3 && { borderLeftWidth: 3, borderLeftColor: medalColor ?? 'transparent' },
                    ]}
                  >
                    <ThemedText style={[styles.rankCell, { width: 40 }]}>
                      {medal ?? `#${i + 1}`}
                    </ThemedText>
                    <ThemedText
                      style={[styles.nameCell, { flex: 1, color: colors.cardText }, isMe && { fontWeight: '700' }]}
                      numberOfLines={1}
                    >
                      {g.firstname} {g.lastname}
                    </ThemedText>
                    <ThemedText style={[styles.dataCell, { width: 52, color: theme.colors.muted }]}>{g.total}</ThemedText>
                    <ThemedText
                      style={[
                        styles.dataCell,
                        { width: 64, color: g.points_total >= 0 ? colors.cardText : theme.colors.muted, fontWeight: '600' },
                      ]}
                    >
                      {g.points_total}
                    </ThemedText>
                  </View>
                );
              })}
            </>
          ) : (
            <ThemedText style={[styles.emptyText, { color: theme.colors.muted }]}>{t('drinks.noData')}</ThemedText>
          )}

          {/* Meine Getränke */}
          {stats?.my_stats && (
            <View style={[styles.myDrinksSection, { borderTopColor: colors.border + '30' }]}>
              <Pressable
                style={styles.myDrinksHeader}
                onPress={() => setMyStatsExpanded((v) => !v)}
              >
                <ThemedText style={[styles.myDrinksTitle, { color: colors.cardText }]}>{t('drinks.myDrinks')}</ThemedText>
                <Ionicons
                  name={myStatsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.cardText}
                />
              </Pressable>

              {myStatsExpanded && (
                stats.my_stats.length === 0 ? (
                  <ThemedText style={[styles.emptyText, { color: theme.colors.muted, marginTop: theme.spacing.sm }]}>
                    {t('drinks.noData')}
                  </ThemedText>
                ) : (
                  stats.my_stats.map((item) => (
                    <View key={item.drink_id} style={styles.myStatRow}>
                      <ThemedText style={[styles.myStatName, { color: colors.cardText }]} numberOfLines={1}>
                        {item.display_name}
                      </ThemedText>
                      <ThemedText style={[styles.myStatCount, { color: theme.colors.muted }]}>{item.count}×</ThemedText>
                      <ThemedText style={[styles.myStatPoints, { color: item.points_total >= 0 ? colors.cardText : theme.colors.muted }]}>
                        {item.points_total >= 0 ? `+${item.points_total}` : `${item.points_total}`} Pts
                      </ThemedText>
                    </View>
                  ))
                )
              )}
            </View>
          )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Toast
  toast: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 99,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  toastPoints: {
    fontWeight: '700',
    fontSize: 16,
  },
  toastBinge: {
    fontSize: 12,
    marginTop: 2,
  },

  // Toggle (kept for toggleBtn/toggleText usage)
  toggleRow: {
    flexDirection: 'row',
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

  // Scroll
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
    paddingBottom: theme.spacing.xxl * 2,
  },

  // Banner
  banner: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  bannerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bannerSub: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.75,
  },
  bannerWarn: {
    fontSize: 13,
    marginTop: 2,
  },

  // Game End
  gameEndBadge: {
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  gameEndText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  // Drink grid
  drinkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  drinkCard: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
  },
  drinkCardName: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  drinkCardConfirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drinkCardConfirmText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },

  // Drink list
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  categoryHeader: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  drinkName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  pointsBadge: {
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Size buttons (multi-size groups)
  sizeButtonRow: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  sizeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  sizeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Bottom action (Log-Button + Cooldown)
  bottomAction: {
    marginHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cooldownText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Leaderboard
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: theme.spacing.xs,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingLeft: theme.spacing.xs,
  },
  rankCell: {
    fontSize: 18,
    textAlign: 'center',
  },
  nameCell: {
    fontSize: 14,
    paddingHorizontal: theme.spacing.sm,
  },
  dataCell: {
    fontSize: 14,
    textAlign: 'right',
    paddingHorizontal: theme.spacing.xs,
  },

  // My stats
  myDrinksSection: {
    marginTop: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: theme.spacing.md,
  },
  myDrinksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  myDrinksTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  myStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  myStatName: {
    flex: 1,
    fontSize: 14,
  },
  myStatCount: {
    fontSize: 14,
    width: 36,
    textAlign: 'right',
  },
  myStatPoints: {
    fontSize: 14,
    fontWeight: '600',
    width: 70,
    textAlign: 'right',
  },

  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
