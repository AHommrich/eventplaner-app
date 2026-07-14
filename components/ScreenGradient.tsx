/**
 * Full-screen soft gradient background for the soft-luxury preset. Absolute-fill
 * behind the screen content (content must be transparent). The gradient is
 * derived from the event's own `screenBg` + `primary` via `screenGradient`, so
 * it stays fully backend-driven. Diagonal for a subtle premium depth.
 */
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { screenGradient } from '../lib/variantStyles';

export function ScreenGradient({ screenBg, primary }: { screenBg: string; primary: string }) {
  return (
    <LinearGradient
      colors={screenGradient(screenBg, primary)}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
