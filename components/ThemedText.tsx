import { Text, TextProps, StyleSheet } from 'react-native';
import { useEventTheme } from '../lib/EventThemeContext';

export function ThemedText({ style, ...props }: TextProps) {
  const { colors } = useEventTheme();

  if (!colors.fontFamily) {
    return <Text style={style} {...props} />;
  }

  const flat = StyleSheet.flatten(style);
  const w = flat?.fontWeight;
  const isBold =
    w === 'bold' || w === '700' || w === '800' || w === '900' || w === '600';
  const fontFamily = isBold ? colors.fontFamily.bold : colors.fontFamily.regular;

  return <Text style={[{ fontFamily }, style]} {...props} />;
}
