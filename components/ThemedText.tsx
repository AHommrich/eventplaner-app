/**
 * `Text` wrapper that transparently applies the backend-selected wedding
 * font.
 *
 * The `EventThemeContext` exposes a `fontFamily = { regular, bold }` pair
 * whenever the couple has picked a heading font. This component looks at the
 * text's declared `fontWeight` and swaps in the matching family — everything
 * from 600 upwards counts as "bold", including numeric string weights that
 * React Native accepts. Consumer code stays completely unaware: it keeps
 * writing `<ThemedText style={{ fontWeight: 'bold' }}>` and the correct
 * family is picked automatically.
 *
 * When no font is configured we forward props to the plain `<Text>` verbatim
 * so React Native's system-font path stays intact — including the tiny cost
 * saving of not spreading a style array in that case.
 */
import { Text, TextProps, StyleSheet } from 'react-native';
import { useEventTheme } from '../lib/EventThemeContext';

export function ThemedText({ style, ...props }: TextProps) {
  const { colors } = useEventTheme();

  if (!colors.fontFamily) {
    return <Text style={style} {...props} />;
  }

  const flat = StyleSheet.flatten(style);
  const w = flat?.fontWeight;
  const isBold = w === 'bold' || w === '700' || w === '800' || w === '900' || w === '600';
  const fontFamily = isBold ? colors.fontFamily.bold : colors.fontFamily.regular;

  return <Text style={[{ fontFamily }, style]} {...props} />;
}
