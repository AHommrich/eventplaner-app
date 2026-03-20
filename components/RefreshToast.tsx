import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventTheme } from '../lib/EventThemeContext';
import { useLanguage } from '../lib/LanguageContext';
import { theme } from '../constants/theme';

type Props = {
  visible: boolean;
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
