/**
 * Hidden guests — guest-side moderation control.
 *
 * Lists uploaders whose photo content the current guest has hidden. Unhide is
 * intentionally one tap: it only restores visibility for future gallery loads
 * and does not affect any other guest.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../components/ThemedText';
import { useLanguage } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';
import { fetchHiddenGuests, HiddenGuest, unhideGuestContent } from '../lib/guest';
import { theme } from '../constants/theme';

export default function HiddenGuestsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();
  const [hiddenGuests, setHiddenGuests] = useState<HiddenGuest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHiddenGuests(await fetchHiddenGuests());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleUnhide(guestId: number) {
    await unhideGuestContent(guestId);
    setHiddenGuests((prev) => prev.filter((guest) => guest.id !== guestId));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
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
            {t('settings.hiddenGuests')}
          </ThemedText>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.tabTint} />
        </View>
      ) : hiddenGuests.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <ThemedText style={{ color: colors.cardText, textAlign: 'center', fontSize: 16 }}>
            {t('settings.hiddenGuestsEmpty')}
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xl,
          }}
        >
          {hiddenGuests.map((guest) => (
            <View
              key={guest.id}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border + '33',
                borderWidth: 1,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
              }}
            >
              <ThemedText style={{ color: colors.cardText, fontSize: 15, flex: 1 }}>
                {guest.firstname} {guest.lastname}
              </ThemedText>
              <TouchableOpacity
                onPress={() => handleUnhide(guest.id)}
                style={{
                  backgroundColor: colors.cardButton,
                  borderRadius: theme.borderRadius.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                }}
              >
                <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600' }}>
                  {t('settings.unhide')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
