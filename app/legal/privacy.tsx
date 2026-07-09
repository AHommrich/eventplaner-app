/**
 * In-app privacy notice screen (Art. 13 DSGVO).
 *
 * Content comes from the backend so wording updates roll out without an App
 * Store submission. States:
 *
 *   - loading .... first fetch not yet resolved.
 *   - error ...... unexpected failure before backend, cache or bundled
 *                   fallback could render. Keeps a browser-open escape hatch.
 *   - success .... sections rendered as plain text with the section heading
 *                   in bold. The `updated_at` timestamp sits above the first
 *                   section so guests know how fresh the copy is.
 *
 * A stale cache (older than 24 h) is preferred when the network is down; if no
 * cache exists, `lib/legal.ts` returns the bundled legal fallback.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { fetchPrivacyNotice, PrivacyNotice } from '../../lib/legal';
import { API_BASE } from '../../constants/env';
import { theme } from '../../constants/theme';

// The web privacy page lives on the same host as the API. Consumed by the
// offline fallback button so guests always have a reachable copy.
const FALLBACK_URL = `${API_BASE}/datenschutz`;

function formatUpdatedAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();

  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchPrivacyNotice(language);
      setNotice(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    // Bootstrap fetch → setNotice / setError / setLoading. Same shape as
    // `app/consents/index.tsx`: state updates happen in the resolved-promise
    // microtask, not synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      {/* Header card — same treatment as consents/data-export: wraps the
          back arrow + title in a card-coloured strip so `colors.cardText`
          stays legible even when it happens to be close to
          `colors.screenBg` in the current palette. */}
      <View
        style={{
          backgroundColor: colors.card,
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: colors.border + '33',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={{ padding: theme.spacing.xs }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.cardText} />
          </TouchableOpacity>
          <ThemedText
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: colors.cardText,
              marginLeft: theme.spacing.xs,
            }}
          >
            {t('legal.privacy.title')}
          </ThemedText>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.tabTint} />
        </View>
      ) : error ? (
        <View
          style={{
            padding: theme.spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.muted} />
          <ThemedText
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: colors.cardText,
              marginTop: theme.spacing.md,
              textAlign: 'center',
            }}
          >
            {t('legal.privacy.offlineTitle')}
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 14,
              color: theme.colors.muted,
              marginTop: theme.spacing.sm,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            {t('legal.privacy.offlineMessage')}
          </ThemedText>
          <TouchableOpacity
            onPress={() => Linking.openURL(FALLBACK_URL)}
            style={{
              marginTop: theme.spacing.lg,
              backgroundColor: colors.cardButton,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm + 2,
              borderRadius: theme.borderRadius.md,
            }}
          >
            <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600' }}>
              {t('legal.privacy.openInBrowser')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={load}
            style={{ marginTop: theme.spacing.md, padding: theme.spacing.sm }}
          >
            <ThemedText style={{ color: colors.cardText, fontSize: 14 }}>
              {t('legal.privacy.retry')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : notice ? (
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xl,
          }}
        >
          <ThemedText
            style={{ fontSize: 12, color: theme.colors.muted, marginBottom: theme.spacing.lg }}
          >
            {t('legal.privacy.updatedAt', { date: formatUpdatedAt(notice.updated_at, language) })}
          </ThemedText>
          {notice.sections.map((section) => (
            <View key={section.id} style={{ marginBottom: theme.spacing.lg }}>
              <ThemedText
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.cardText,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {section.heading}
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: colors.cardText, lineHeight: 22 }}>
                {section.body_markdown}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
