/**
 * Loading placeholder block with a shimmering sweep. Used wherever a screen
 * used to show a full-screen `ActivityIndicator` — the skeleton mirrors the
 * real layout so content doesn't jump when data arrives.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventTheme } from '../../lib/EventThemeContext';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, style }: Props) {
  const { colors } = useEventTheme();
  const shimmer = useSharedValue(-1);
  const [layoutWidth, setLayoutWidth] = useState(200);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [shimmer]);

  const sweepStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: interpolate(
            shimmer.value,
            [-1, 1],
            [-layoutWidth, layoutWidth],
            Extrapolation.CLAMP
          ),
        },
      ],
    }),
    [layoutWidth]
  );

  return (
    <View
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      style={[
        { width, height, borderRadius, overflow: 'hidden', backgroundColor: colors.cardText + '14' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
        <LinearGradient
          colors={['transparent', colors.card + '99', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
