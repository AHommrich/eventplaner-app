/**
 * Drinks tab — the "drink game" feature.
 *
 * Two views inside one screen, toggled at the top:
 *
 *   1. **Log view.** Guest picks a drink from a searchable catalogue
 *      (accordion by category, or a flat filtered list when a search query
 *      is active). Some catalogs have multiple sizes (e.g. Bier 0.3 l /
 *      0.5 l); those expand inline into size buttons with per-size point
 *      values. A single-size catalog acts as a two-tap confirm: first tap
 *      selects the row, second tap logs the drink.
 *
 *   2. **Leaderboard view.** Live per-guest totals + points table, plus a
 *      collapsible "my drinks" breakdown. Polls stats every 5 s while the
 *      view is open; the polling loop tears down on view switch or unmount.
 *
 * Behavioural constraints:
 *   - **60 s cooldown** between logs to discourage spam-logging.
 *   - **Streak + binge penalty** — the backend replies with
 *     `binge_penalty: true` when the streak triggers the abstinence rule;
 *     we surface it as a warning banner and a toast.
 *   - **Game end.** `EventInfo.drink_game_end_time` is checked every 10 s;
 *     after it passes, all buttons freeze into a "game ended" state.
 *   - **`drinks_blocked` code (from `lib/api.ts`).** Handled globally — the
 *     tab-layout redirects off this screen when the block fires.
 */
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

/**
 * One size of a catalog entry. `drink_id` is the loggable id (unique per
 * size), `id` is the size id inside the catalog. The distinction matters
 * because logging must reference the SIZE, not the parent catalog.
 */
type DrinkSize = {
  drink_id: number;     // used for POST /api/drinks/log
  id: number;           // size_id
  amount_liter: number | null;
  is_default: boolean;
  points: number | null;
};

/**
 * A logical drink group (e.g. "Bier") with N size variants. `id` here is the
 * catalog id — NOT usable for logging directly, only its sizes carry the
 * loggable `drink_id`.
 */
type DrinkCatalog = {
  id: number;           // catalog_id (NOT for logging)
  display_name: string;
  category: string;
  category_label: string;
  is_alcoholic: boolean;
  sizes: DrinkSize[];
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

/** Podium medal emojis + accent colours for the top-three leaderboard rows. */
const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#C9A84C', '#A8A9AD', '#CD7F32'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrinksScreen() {
  const { t, language } = useLanguage();
  const { colors, eventInfo, loadTheme } = useEventTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [view, setView] = useState<'log' | 'leaderboard'>('log');
  const [drinks, setDrinks] = useState<DrinkCatalog[]>([]);
  const [selectedSize, setSelectedSize] = useState<DrinkSize | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null); // catalog.id
  const [logging, setLogging] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [myStatsExpanded, setMyStatsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
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

  // Poll the game-end sentinel every 10 s. Cheap arithmetic — we compare the
  // configured end time against `Date.now()` — but critical: once past, every
  // downstream button gates on `gameEnded`, freezing the UI.
  useEffect(() => {
    if (!endTime) return;
    const check = () => setGameEnded(new Date(endTime).getTime() <= Date.now());
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [endTime]);

  // ── Cooldown countdown ─────────────────────────────────────────────────────

  // 1 Hz decrement of the cooldown counter. `Math.max(0, Math.ceil(c) - 1)`
  // ensures we settle exactly at 0 even if the initial value was a
  // fractional `retry_after` from the backend (e.g. 59.7 s).
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, Math.ceil(c) - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Leaderboard polling ────────────────────────────────────────────────────

  // Only the leaderboard view drives the 5 s stats-refresh loop; the log view
  // relies on the cooldown timer and the toast to reflect the guest's own
  // last action, so we don't need to hammer stats there.
  useEffect(() => {
    if (view !== 'leaderboard') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(loadStats, 5_000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    // Interval is tied to the `view === 'leaderboard'` mode only. Re-creating
    // the interval on every render (which listing `loadStats` as a dep would
    // do) would reset the 5 s polling clock on any state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Initial load on focus ──────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    loadInitial();
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // Focus-effect callback intentionally re-runs on every focus, NOT every
    // render — that's what `useCallback([])` + `useFocusEffect` guarantees
    // together. Adding `loadInitial` as a dep would recreate the callback
    // on each render and defeat the focus semantics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // ── Data loading ───────────────────────────────────────────────────────────

  /** Cold-load: catalog + stats in parallel so the log view has something to render. */
  async function loadInitial() {
    setLoading(true);
    try {
      const [drinksRes, statsRes] = await Promise.all([
        api.get<{ data: DrinkCatalog[] }>('/api/drinks'),
        api.get<Stats>('/api/drinks/stats'),
      ]);
      setDrinks(drinksRes.data.data);
      applyStats(statsRes.data);
    } catch {
      // Errors are handled globally by the axios interceptor (app_blocked,
      // drinks_blocked). Everything else is swallowed here — the empty
      // state renders and the guest can retry via pull-to-refresh.
    } finally {
      setLoading(false);
    }
  }

  /** Stats-only refresh used by the leaderboard poll AND pull-to-refresh. */
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

  /**
   * The single log-and-score action. Backend response drives:
   *   - `final_points` → toast + optimistic UI reset
   *   - `binge_penalty` → warning subtitle on the toast
   * Error `code: 'cooldown'` uses the returned `retry_after` (rounded up) so
   * the client cooldown matches the server truth. `code: 'game_ended'`
   * freezes the UI.
   */
  async function handleLog(size: DrinkSize) {
    if (logging || cooldown > 0 || gameEnded) return;
    setLogging(true);
    try {
      const res = await api.post<LogResponse>('/api/drinks/log', { drink_id: size.drink_id });
      const data = res.data;
      setCooldown(60);
      showToast({ points: data.final_points, bingePenalty: data.binge_penalty });
      setSelectedSize(null);
      setSelectedGroup(null);
      loadStats();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'cooldown') {
        setCooldown(Math.ceil(e.response.data.retry_after ?? 60));
        setSelectedSize(null);
        setSelectedGroup(null);
      } else if (code === 'game_ended') {
        setGameEnded(true);
      }
      // `drinks_blocked` is handled by the axios interceptor globally.
    } finally {
      setLogging(false);
    }
  }

  function showToast(data: ToastData) {
    setToast(data);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Format a size like `0.3 l` or `4 cl`. `cl` for anything under 0.1 l
   * (shots), `l` otherwise with a locale-appropriate decimal separator and
   * trailing zeros trimmed.
   */
  function formatSize(amountLiter: number | null | undefined): string {
    if (amountLiter == null || isNaN(amountLiter)) return '?';
    if (amountLiter < 0.1) return `${Math.round(amountLiter * 100)} cl`;
    const sep = language === 'en' ? '.' : ',';
    const str = amountLiter.toFixed(2).replace('.', sep).replace(/0+$/, '').replace(new RegExp(`\\${sep}$`), '');
    return `${str} l`;
  }

  // ── Render a drink row ─────────────────────────────────────────────────────

  /**
   * Renders a single catalog row. Multi-size catalogs render as an accordion
   * whose expanded state shows size buttons instead of the label + points;
   * single-size catalogs use a two-tap confirm to prevent misfires.
   */
  function renderCatalogItem(catalog: DrinkCatalog) {
    const isMulti = catalog.sizes.length > 1;
    const disabled = gameEnded || cooldown > 0;

    if (isMulti) {
      const isExpanded = selectedGroup === catalog.id;
      return (
        <TouchableOpacity
          key={catalog.id}
          style={[
            styles.drinkRow,
            { borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
            isExpanded && { backgroundColor: colors.primary + '08' },
            disabled && !isExpanded && { opacity: 0.45 },
          ]}
          onPress={() => {
            if (disabled) return;
            setSelectedSize(null);
            setSelectedGroup(isExpanded ? null : catalog.id);
          }}
          activeOpacity={0.75}
          disabled={disabled && !isExpanded}
        >
          {isExpanded ? (
            <View style={styles.sizeButtonRow}>
              {catalog.sizes.map((size) => (
                <TouchableOpacity
                  key={size.id}
                  style={[styles.sizeButton, { backgroundColor: colors.cardButton, borderWidth: 1.5, borderColor: colors.cardButton, borderRadius: theme.borderRadius.lg - theme.spacing.xs }]}
                  onPress={() => handleLog(size)}
                  disabled={logging}
                  activeOpacity={0.8}
                >
                  {logging
                    ? <ActivityIndicator color={colors.cardButtonText} size="small" />
                    : <ThemedText style={[styles.sizeButtonText, { color: colors.cardButtonText }]}>{formatSize(size.amount_liter)}?</ThemedText>
                  }
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              <ThemedText style={[styles.drinkName, { color: colors.cardText }]}>{catalog.display_name}</ThemedText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                {catalog.sizes.map((size) => {
                  if (size.points == null) return null;
                  const pos = size.points >= 0;
                  return (
                    <View key={size.id} style={[styles.pointsBadge, { backgroundColor: pos ? colors.primary + '18' : '#00000010' }]}>
                      <ThemedText style={[styles.pointsText, { color: colors.cardText }]}>
                        {pos ? `+${size.points}` : `${size.points}`}
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

    // Single-size catalog — two-tap confirm to avoid accidental logs.
    const size = catalog.sizes[0];
    const isSelected = selectedSize?.drink_id === size?.drink_id;
    const positive = (size?.points ?? 0) >= 0;

    return (
      <TouchableOpacity
        key={catalog.id}
        style={[
          styles.drinkRow,
          { borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
          disabled && !isSelected && { opacity: 0.45 },
        ]}
        onPress={() => {
          setSelectedGroup(null);
          if (isSelected) {
            handleLog(size);
          } else {
            setSelectedSize(size);
          }
        }}
        activeOpacity={0.75}
        disabled={disabled && !isSelected}
      >
        {isSelected ? (
          <View style={styles.sizeButtonRow}>
            <TouchableOpacity
              style={[styles.sizeButton, { backgroundColor: colors.cardButton, borderWidth: 1.5, borderColor: colors.cardButton, borderRadius: theme.borderRadius.lg - theme.spacing.xs }]}
              onPress={() => handleLog(size)}
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
            <ThemedText style={[styles.drinkName, { color: colors.cardText }]}>{catalog.display_name}</ThemedText>
            {size?.points != null && (
              <View style={[styles.pointsBadge, { backgroundColor: positive ? colors.primary + '18' : '#00000010' }]}>
                <ThemedText style={[styles.pointsText, { color: colors.cardText }]}>
                  {positive ? `+${size.points}` : `${size.points}`}
                </ThemedText>
              </View>
            )}
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

      {/* Log-result toast — replaces the refresh toast while active. */}
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

      {/* Card 1: view toggle + streak/game-end banner. */}
      <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, overflow: 'hidden' }}>

        {/* Log / Leaderboard toggle. */}
        <View style={{ flexDirection: 'row', margin: theme.spacing.xs, borderRadius: theme.borderRadius.lg - theme.spacing.xs, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border + '55' }}>
          <TouchableOpacity
            style={[styles.toggleBtn, {
              backgroundColor: view === 'log' ? colors.cardButton : 'transparent',
              borderRightWidth: 1,
              borderRightColor: colors.border + '55',
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

        {/* Streak and binge-penalty banner — only shows in log view. */}
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

        {/* Game-end / end-time banner. */}
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

            {/* Card 2: search + drink list. */}
            <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', overflow: 'hidden' }}>

              {/* Search input — filters across name and category label. */}
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

              {/* Drink list — either flat search results or category accordion. */}
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
                  return results.map(renderCatalogItem);
                })()
              ) : (
                (() => {
                  // Group drinks by category into insertion-ordered buckets so
                  // the backend's category ordering is preserved.
                  const categoryOrder: string[] = [];
                  const categoryMap: Record<string, { label: string; items: DrinkCatalog[] }> = {};
                  for (const catalog of drinks) {
                    if (!categoryMap[catalog.category]) {
                      categoryOrder.push(catalog.category);
                      categoryMap[catalog.category] = { label: catalog.category_label, items: [] };
                    }
                    categoryMap[catalog.category].items.push(catalog);
                  }
                  return categoryOrder.map((cat) => {
                    const { label, items } = categoryMap[cat];
                    const isOpen = expandedCategories.has(cat);
                    return (
                      <View key={cat}>
                        <TouchableOpacity
                          style={[styles.categoryRow, { borderBottomWidth: 1, borderBottomColor: colors.border + '30' }]}
                          onPress={() => {
                            setExpandedCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(cat)) next.delete(cat); else next.add(cat);
                              return next;
                            });
                            // Collapse category → clear a pending selection
                            // that would otherwise belong to a hidden row.
                            if (selectedSize && items.some((c) => c.sizes.some((s) => s.drink_id === selectedSize.drink_id))) {
                              setSelectedSize(null);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.categoryHeader, { color: colors.cardText }]}>{label}</ThemedText>
                          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.cardText} />
                        </TouchableOpacity>
                        {isOpen && (
                          <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary + '50' }}>
                            {items.map(renderCatalogItem)}
                          </View>
                        )}
                      </View>
                    );
                  });
                })()
              )}
            </View>

          </ScrollView>

          {/* Cooldown banner — sits directly above the tab bar during cooldown. */}
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

          {/* Ranking table. Podium rows carry a left accent strip. */}
          <View style={{ backgroundColor: colors.card, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: colors.border + '33', padding: theme.spacing.md }}>
          {stats?.guest_totals && stats.guest_totals.length > 0 ? (
            <>
              {/* Column headers. */}
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

          {/* My-drinks breakdown — collapsible so it doesn't dominate the view. */}
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

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
    paddingBottom: theme.spacing.xxl * 2,
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

  gameEndText: {
    fontSize: 14,
    fontWeight: '600',
  },

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

  bottomAction: {
    marginHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  cooldownText: {
    fontSize: 16,
    fontWeight: '600',
  },

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

  myDrinksSection: {
    marginTop: theme.spacing.xl,
    borderTopWidth: 1,
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
    padding: theme.spacing.lg,
  },
});
