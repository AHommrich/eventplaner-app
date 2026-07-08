/**
 * Consent management screen.
 *
 * Lists every consent purpose the app knows about (from `lib/consents.ts`)
 * with its current state — granted (+ timestamp) or not granted — and a
 * revoke action. Art. 7 (3) requires withdrawal to be as easy as granting;
 * this screen is that surface.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import {
  getConsent,
  revokeConsent,
  ConsentKey,
  ConsentRecord,
  ALL_PURPOSES,
} from '../../lib/consents';
import { theme } from '../../constants/theme';

/** Locale-key shard per purpose (matches the pattern in ConsentGate.tsx). */
const LOCALE_SHARD: Record<ConsentKey, string> = {
  photo_upload: 'photoUpload',
  photo_game: 'photoGame',
  camera_scan: 'cameraScan',
};

function formatGrantedAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function ConsentsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<Record<ConsentKey, ConsentRecord | null>>({
    photo_upload: null,
    photo_game: null,
    camera_scan: null,
  });

  const load = useCallback(async () => {
    const entries = await Promise.all(
      ALL_PURPOSES.map(async (p) => [p, await getConsent(p)] as const)
    );
    const next: Record<ConsentKey, ConsentRecord | null> = {
      photo_upload: null,
      photo_game: null,
      camera_scan: null,
    };
    for (const [p, r] of entries) next[p] = r;
    setRecords(next);
  }, []);

  useEffect(() => {
    // Bootstrap fetch → setRecords. The async `load()` updates state after
    // the effect returns, not synchronously within it, so React 19's
    // `set-state-in-effect` check is a false positive — the setState runs
    // in the resolved-promise microtask, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleRevoke(purpose: ConsentKey) {
    await revokeConsent(purpose);
    await load();
  }

  function confirmRevoke(purpose: ConsentKey) {
    Alert.alert(t('consents.revoke'), t(`consents.${LOCALE_SHARD[purpose]}.title`), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('consents.revoke'), style: 'destructive', onPress: () => handleRevoke(purpose) },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      {/* Header card — wraps the back arrow + title in a card-coloured
          strip so `colors.cardText` is guaranteed legible regardless of
          how similar `colors.cardText` and `colors.screenBg` happen to be
          in the current event palette. Padding-top from safe-area lives
          inside the card so the tinted background reaches to the notch. */}
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
            {t('consents.title')}
          </ThemedText>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xl,
        }}
      >
        <ThemedText
          style={{
            fontSize: 14,
            color: theme.colors.muted,
            marginBottom: theme.spacing.lg,
            lineHeight: 20,
          }}
        >
          {t('consents.subtitle')}
        </ThemedText>
        {ALL_PURPOSES.map((purpose) => {
          const record = records[purpose];
          return (
            <View
              key={purpose}
              style={{
                backgroundColor: colors.card,
                borderRadius: theme.borderRadius.lg,
                borderWidth: 2,
                borderColor: colors.border + '33',
                padding: theme.spacing.md,
                marginBottom: theme.spacing.md,
              }}
            >
              <ThemedText
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.cardText,
                  marginBottom: theme.spacing.xs,
                }}
              >
                {t(`consents.${LOCALE_SHARD[purpose]}.title`)}
              </ThemedText>
              <ThemedText
                style={{ fontSize: 12, color: theme.colors.muted, marginBottom: theme.spacing.sm }}
              >
                {record
                  ? t('consents.grantedAt', { date: formatGrantedAt(record.granted_at, language) })
                  : t('consents.notGranted')}
              </ThemedText>
              {record && (
                <TouchableOpacity
                  onPress={() => confirmRevoke(purpose)}
                  style={{ paddingVertical: theme.spacing.sm, alignItems: 'flex-start' }}
                >
                  <ThemedText style={{ color: theme.colors.error, fontWeight: '600' }}>
                    {t('consents.revoke')}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
