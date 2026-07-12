/**
 * Animated floating toast anchored below the safe area. Visibility and
 * auto-dismiss timing stay with the caller — this only owns the fade
 * in/out and the shared chrome.
 */
import type { ReactNode } from 'react';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';

type Props = {
  visible: boolean;
  children: ReactNode;
  testID?: string;
};

export function Toast({ visible, children, testID }: Props) {
  const { colors } = useEventTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(150)}
      testID={testID}
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
      {children}
    </Animated.View>
  );
}
