/**
 * Post-erasure landing screen.
 *
 * Reached in two ways:
 *
 *   1. Right after a successful `POST /api/guest/erasure`. The Settings
 *      screen calls `saveErasureState()`, clears the session and pushes the
 *      guest here so they can copy the recovery token before it disappears
 *      from screen.
 *   2. On next app launch while an erasure is still pending (no session,
 *      but `getErasureState()` returns a value). `app/index.tsx` performs
 *      the redirect so the guest can revoke from a cold start.
 *
 * The screen intentionally does NOT depend on a Sanctum bearer — after
 * erasure the backend revoked the token. Auth for the revoke endpoint is
 * carried by the recovery token in the request body.
 *
 * If the grace window has expired we still render the screen but disable
 * the revoke button and show the reason — the guest can then only log out
 * (which just clears the local erasure state; nothing to hit on the backend
 * because the guest row is either purged or will be by the next cron run).
 */
import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../lib/LanguageContext';
import { theme } from '../constants/theme';
import {
  ErasureState,
  getErasureState,
  clearErasureState,
} from '../lib/erasure';
import { revokeErasure } from '../lib/guest';

const SPLASH_COLORS = ['#FF6B8A', '#FF8C5A', '#FFD166', '#72D4C8'] as const;

/**
 * Format an ISO timestamp for display. Uses the browser-provided locale so
 * the same string works on iOS + Android without a manual matrix.
 */
function formatDate(iso: string, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function ErasurePendingScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ErasureState | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getErasureState().then((s) => {
      setState(s);
      setLoading(false);
      // If we land here without an erasure state, redirect to welcome —
      // the guest arrived by an unexpected route (deep link, browser
      // back etc.) and nothing on this screen has meaning.
      if (!s) router.replace('/');
    });
    // Bootstrap probe — the redirect only makes sense once, on mount. The
    // `router` reference from expo-router is stable enough that adding it
    // as a dep would still be correct, but the intent is "run once".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const canRevoke =
    state !== null && !!state.canRevokeUntil && new Date(state.canRevokeUntil) > now;

  /**
   * Copy the recovery token to the OS clipboard. The visual confirmation
   * lasts two seconds — long enough to notice, short enough not to trap
   * the "confirmed" label on screen indefinitely.
   */
  async function copyToken() {
    if (!state) return;
    await Clipboard.setStringAsync(state.recoveryToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Ask twice before firing the revoke — matches the double-confirm the
   * declined-flow uses elsewhere (`rsvp.declineConfirm*`). On success we
   * clear the local erasure state and drop the guest back on the welcome
   * screen so they can re-scan their QR code.
   */
  function askRevoke() {
    if (!state) return;
    Alert.alert(
      t('erasure.pending.revokeConfirmTitle'),
      t('erasure.pending.revokeConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('erasure.pending.revokeConfirmButton'),
          style: 'destructive',
          onPress: performRevoke,
        },
      ],
    );
  }

  async function performRevoke() {
    if (!state) return;
    setRevoking(true);
    try {
      await revokeErasure(state.recoveryToken);
      await clearErasureState();
      Alert.alert(
        t('erasure.pending.revokeSuccessTitle'),
        t('erasure.pending.revokeSuccessBody'),
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (e: any) {
      const status = e?.response?.status;
      const message =
        status === 403
          ? t('erasure.pending.revokeErrorInvalidToken')
          : status === 410
          ? t('erasure.pending.revokeErrorExpired')
          : t('erasure.pending.revokeErrorGeneric');
      Alert.alert(t('common.error'), message);
    } finally {
      setRevoking(false);
    }
  }

  /**
   * "Log out" from this screen just wipes the erasure state and drops back
   * to welcome — after erasure there is no server session to revoke.
   */
  async function handleLogout() {
    await clearErasureState();
    router.replace('/');
  }

  if (loading || !state) return null;

  return (
    <LinearGradient
      colors={SPLASH_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bg}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="warning" size={48} color="#fff" />
        </View>

        <ThemedText style={styles.title}>{t('erasure.pending.title')}</ThemedText>
        <ThemedText style={styles.subtitle}>
          {t('erasure.pending.subtitle', {
            date: formatDate(state.scheduledAt, language),
          })}
        </ThemedText>

        {/* Recovery token card — the visual centrepiece; without this the
            guest cannot revoke via the app. */}
        <View style={styles.card}>
          <ThemedText style={styles.cardLabel}>
            {t('erasure.pending.recoveryTokenLabel')}
          </ThemedText>
          <View style={styles.tokenBox}>
            <ThemedText style={styles.tokenText}>{state.recoveryToken}</ThemedText>
          </View>
          <ThemedText style={styles.cardHint}>
            {t('erasure.pending.recoveryTokenHint')}
          </ThemedText>
          <TouchableOpacity style={styles.copyButton} onPress={copyToken}>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={16}
              color={theme.colors.primary}
            />
            <ThemedText style={styles.copyButtonText}>
              {copied ? t('erasure.pending.copied') : t('erasure.pending.copyToken')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {canRevoke && (
          <ThemedText style={styles.windowLabel}>
            {t('erasure.pending.canRevokeUntil', {
              date: formatDate(state.canRevokeUntil, language),
            })}
          </ThemedText>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, (!canRevoke || revoking) && styles.disabledButton]}
          onPress={askRevoke}
          disabled={!canRevoke || revoking}
        >
          <ThemedText style={styles.primaryButtonText}>
            {revoking
              ? t('erasure.pending.revokeSubmitting')
              : t('erasure.pending.revokeButton')}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
          <ThemedText style={styles.secondaryButtonText}>
            {t('erasure.pending.logoutButton')}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  tokenBox: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.muted + '33',
  },
  tokenText: {
    fontSize: 15,
    fontFamily: 'Courier',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  cardHint: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  copyButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  windowLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  primaryButtonText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.4,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
  },
});
