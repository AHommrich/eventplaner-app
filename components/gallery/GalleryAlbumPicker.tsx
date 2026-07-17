import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';

export type GalleryAlbumOption = {
  id: number;
  slug: string;
  name: string;
};

/**
 * Album switcher styled as the drink-game segmented toggle: one rounded bar
 * split into segments, the active segment filled with cardButton, inactive
 * segments transparent — not separate pills.
 */
export function GalleryAlbumPicker({
  albums,
  selectedId,
  onSelect,
}: {
  albums: GalleryAlbumOption[];
  selectedId: number | null;
  onSelect: (albumId: number) => void;
}) {
  const { colors, variant } = useEventTheme();

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: variant.radius.button,
          borderColor: colors.border + '55',
          backgroundColor: colors.card,
        },
      ]}
    >
      {albums.map((album) => {
        const selected = album.id === selectedId;
        return (
          <TouchableOpacity
            key={album.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(album.id)}
            style={[
              styles.segment,
              {
                borderRadius: variant.radius.button - 3,
                backgroundColor: selected ? colors.cardButton : 'transparent',
              },
            ]}
          >
            <ThemedText
              numberOfLines={1}
              style={[styles.text, { color: selected ? colors.cardButtonText : colors.cardText }]}
            >
              {album.name}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderWidth: 1.5, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center' },
  text: { fontWeight: '600', fontSize: 14 },
});
