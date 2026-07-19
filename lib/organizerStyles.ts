import { TextStyle, ViewStyle } from 'react-native';
import { useEventTheme } from './EventThemeContext';
import { cardSurfaceStyle } from './variantStyles';

/** Shared Organizer presentation tokens, all derived from the bound event. */
export function useOrganizerStyles(): {
  colors: ReturnType<typeof useEventTheme>['colors'];
  screen: ViewStyle;
  card: ViewStyle;
  title: TextStyle;
  text: TextStyle;
  /** Dimmed secondary/hint text on cards — legible on every event theme. */
  muted: TextStyle;
  button: ViewStyle;
  buttonText: TextStyle;
  outline: ViewStyle;
  input: TextStyle & ViewStyle;
  tile: ViewStyle;
} {
  const { colors, variant } = useEventTheme();

  return {
    colors,
    screen: { backgroundColor: colors.screenBg },
    card: cardSurfaceStyle(variant, colors.card, colors.border),
    title: { color: colors.cardText },
    text: { color: colors.cardText },
    muted: { color: colors.mutedOnCard },
    button: { backgroundColor: colors.cardButton, borderRadius: variant.radius.button },
    buttonText: { color: colors.cardButtonText },
    outline: { borderColor: colors.border, borderRadius: variant.radius.button },
    input: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.cardText,
      borderRadius: variant.radius.button,
    },
    tile: {
      backgroundColor: colors.screenBg,
      borderColor: colors.border,
      borderRadius: variant.radius.tile,
    },
  };
}
