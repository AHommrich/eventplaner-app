/**
 * Small floating toast that appears at the top of a screen after a
 * pull-to-refresh completes.
 *
 * Rendered by every tab that uses `useRefreshToast()`. The `visible` prop is
 * driven by the hook's `refreshed` flag — the toast pops in for ~2 s once the
 * spinner has closed and then disappears without any animation. The
 * `refreshing` prop is intentionally accepted (see `Props`) but unused so
 * callers can pass it symmetrically alongside `visible`; if a spinner-in-toast
 * variant is ever wanted, this is where it would land.
 *
 * Positioning is safe-area-aware so the toast sits below the iOS notch and
 * above the Android status bar without clipping. Colours come from the
 * dynamic event theme so the toast matches whatever palette is active.
 */
import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventTheme } from '../lib/EventThemeContext';
import { useLanguage } from '../lib/LanguageContext';
import { theme } from '../constants/theme';

type Props = {
  visible: boolean;
  /** Reserved for a future spinner-in-toast variant — currently unused. */
  refreshing: boolean;
};

export function RefreshToast({ visible }: Props) {
  const { colors } = useEventTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + theme.spacing.sm,
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        zIndex: 99,
        backgroundColor: colors.cardButton,
        borderWidth: 2,
        borderColor: colors.border + '33',
        borderRadius: theme.borderRadius.lg - theme.spacing.xs,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        alignItems: 'center',
      }}
    >
      <ThemedText style={{ color: colors.cardButtonText, fontSize: 14, fontWeight: '700' }}>
        ✓ {t('common.refreshed')}
      </ThemedText>
    </View>
  );
}
