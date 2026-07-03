/**
 * Art. 15 GDPR data export screen.
 *
 * Fetches the guest's full data payload via `exportMyData()` and offers two
 * ways to consume it: read on screen (per-section preview) or export as a
 * portable format — JSON to clipboard for machine-readable use, or via the
 * OS share sheet for pasting into a mail/notes app. No file writes:
 * `Share.share({ message })` on both platforms accepts a raw string, which
 * keeps the client free of `expo-file-system` write permissions on this
 * particular flow.
 *
 * Sanctum bearer is required (the interceptor in `lib/api.ts` attaches it).
 * If the fetch fails we show a plain retry surface — network hiccups are
 * the only realistic failure mode; a 401 would have redirected earlier.
 */
import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';
import { theme } from '../constants/theme';
import { exportMyData, GuestExport } from '../lib/guest';

/** Localised, human-readable timestamp — falls back to the raw string on error. */
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

export default function DataExportScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<GuestExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const payload = await exportMyData();
      setData(payload);
    } catch {
      setError(t('dataExport.errorMessage'));
    } finally {
      setLoading(false);
    }
  }

  async function copyJson() {
    if (!data) return;
    await Clipboard.setStringAsync(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareJson() {
    if (!data) return;
    await Share.share({ message: JSON.stringify(data, null, 2) });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      {/* Top bar — mirrors the pattern used in `app/legal/privacy.tsx` so
          both DSGVO screens share the same look. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: theme.spacing.sm }}>
          <Ionicons name="chevron-back" size={24} color={colors.cardText} />
        </TouchableOpacity>
        <ThemedText
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: '600',
            color: colors.cardText,
            marginLeft: theme.spacing.xs,
          }}
        >
          {t('dataExport.title')}
        </ThemedText>
      </View>

      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.tabTint} />
          <ThemedText style={{ marginTop: theme.spacing.md, color: colors.cardText + 'aa' }}>
            {t('dataExport.loading')}
          </ThemedText>
        </View>
      )}

      {!loading && error && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
          <Ionicons name="cloud-offline" size={48} color={theme.colors.error} />
          <ThemedText style={{ fontSize: 18, fontWeight: '600', color: colors.cardText, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs }}>
            {t('dataExport.errorTitle')}
          </ThemedText>
          <ThemedText style={{ fontSize: 14, color: colors.cardText + 'aa', textAlign: 'center', marginBottom: theme.spacing.lg }}>
            {error}
          </ThemedText>
          <TouchableOpacity
            onPress={loadData}
            style={{ backgroundColor: colors.cardButton, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.md }}
          >
            <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600' }}>{t('dataExport.retry')}</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {!loading && data && (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl }}
        >
          <ThemedText style={{ fontSize: 14, color: colors.cardText + 'aa', marginBottom: theme.spacing.md, lineHeight: 20 }}>
            {t('dataExport.subtitle')}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: colors.cardText + '99', marginBottom: theme.spacing.md, fontStyle: 'italic' }}>
            {t('dataExport.generatedAt', { date: formatDate(data.generated_at, language) })}
          </ThemedText>

          {/* Per-section preview cards. Renders raw JSON.stringify slices —
              readable enough for lay users, without a per-key i18n matrix. */}
          <Section
            title={t('dataExport.sections.guest')}
            body={JSON.stringify(data.guest, null, 2)}
            colors={colors}
          />
          <Section
            title={t('dataExport.sections.familyMembers')}
            body={
              data.family_members.length === 0
                ? t('dataExport.sections.empty')
                : JSON.stringify(data.family_members, null, 2)
            }
            colors={colors}
          />
          <Section
            title={t('dataExport.sections.photos')}
            body={
              data.photos.length === 0
                ? t('dataExport.sections.empty')
                : JSON.stringify(data.photos, null, 2)
            }
            colors={colors}
          />
          <Section
            title={t('dataExport.sections.drinkLogs')}
            body={
              data.drink_logs.length === 0
                ? t('dataExport.sections.empty')
                : JSON.stringify(data.drink_logs, null, 2)
            }
            colors={colors}
          />
          <Section
            title={t('dataExport.sections.photoGame')}
            body={
              data.photo_game_submission
                ? JSON.stringify(data.photo_game_submission, null, 2)
                : t('dataExport.sections.empty')
            }
            colors={colors}
          />

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <TouchableOpacity
              onPress={copyJson}
              style={{
                flex: 1,
                backgroundColor: colors.cardButton,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={colors.cardButtonText}
              />
              <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600' }}>
                {copied ? t('dataExport.copied') : t('dataExport.copyJson')}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={shareJson}
            style={{
              marginTop: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border + '55',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="share-outline" size={16} color={colors.cardText} />
            <ThemedText style={{ color: colors.cardText, fontWeight: '600' }}>
              {t('dataExport.share')}
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * One collapsible-looking section — really just a titled card with a
 * pre-formatted JSON body. Kept local to this file because it's not
 * reused elsewhere.
 */
function Section({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useEventTheme>['colors'];
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: colors.border + '33',
      }}
    >
      <ThemedText
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: colors.cardText,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </ThemedText>
      <ThemedText
        style={{
          fontSize: 12,
          fontFamily: 'Courier',
          color: colors.cardText,
          lineHeight: 16,
        }}
      >
        {body}
      </ThemedText>
    </View>
  );
}
