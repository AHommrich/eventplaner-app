/**
 * Inline error card with an optional retry button — the standard
 * replacement for a bare red error text or an `Alert.alert` on a fetch
 * failure. Destructive confirmations and mutation errors still use
 * `Alert.alert`; this is only for "the initial load failed" states.
 */
import { Pressable, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThemedText } from '../ThemedText';
import { useLanguage } from '../../lib/LanguageContext';
import { theme } from '../../constants/theme';
import { haptics } from '../../lib/haptics';

type Props = {
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
};

export function ErrorBanner({ message, onRetry, style }: Props) {
  const { t } = useLanguage();

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      style={[
        {
          backgroundColor: theme.colors.error + '15',
          borderWidth: 1,
          borderColor: theme.colors.error + '55',
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      <ThemedText style={{ color: theme.colors.error, fontSize: 14 }}>{message}</ThemedText>
      {onRetry && (
        <Pressable
          testID="error-banner-retry"
          onPress={() => {
            haptics.selection();
            onRetry();
          }}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.borderRadius.full,
            borderWidth: 1,
            borderColor: theme.colors.error + '55',
          }}
        >
          <ThemedText style={{ color: theme.colors.error, fontSize: 13, fontWeight: '700' }}>
            {t('common.retry')}
          </ThemedText>
        </Pressable>
      )}
    </Animated.View>
  );
}
