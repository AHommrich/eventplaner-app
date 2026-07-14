/**
 * Absolute-fill glossy gradient derived from a single base colour, meant to be
 * dropped as the first child of a button (content renders on top). The gradient
 * is computed from `color` via `sheenGradient`, so it stays fully backend-driven
 * — change the base colour and the whole gradient follows.
 */
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sheenGradient } from '../lib/variantStyles';

export function GradientFill({ color, radius }: { color: string; radius: number }) {
  return (
    <LinearGradient
      colors={sheenGradient(color)}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      pointerEvents="none"
    />
  );
}
