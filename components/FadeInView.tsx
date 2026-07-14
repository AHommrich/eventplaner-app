/**
 * Mount entrance: fade + slight upward slide. Uses a shared value +
 * `useAnimatedStyle` (NOT reanimated's layout `entering`, which crashes the
 * react-test-renderer) so it stays test-safe like the rest of the app.
 *
 * `enabled={false}` renders it fully visible with no motion — used so the
 * classic preset stays byte-for-byte static while soft-luxury animates.
 */
import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export function FadeInView({
  delay = 0,
  enabled = true,
  style,
  children,
}: {
  delay?: number;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  // Skip the timed animation under Jest — mount-time `withTiming` crashes the
  // react-test-renderer; render fully visible + static instead.
  const isTest = typeof process !== 'undefined' && !!process.env.JEST_WORKER_ID;
  const progress = useSharedValue(enabled && !isTest ? 0 : 1);
  useEffect(() => {
    if (enabled && !isTest) progress.value = withDelay(delay, withTiming(1, { duration: 380 }));
  }, [enabled, delay, progress, isTest]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
