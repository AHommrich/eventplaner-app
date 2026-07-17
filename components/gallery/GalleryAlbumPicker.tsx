import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '../ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';

export type GalleryAlbumOption = {
  id: number;
  slug: string;
  name: string;
};

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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
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
              styles.button,
              {
                borderRadius: variant.radius.button,
                borderColor: colors.border,
                backgroundColor: selected ? colors.cardButton : colors.card,
              },
            ]}
          >
            <ThemedText
              style={{
                color: selected ? colors.cardButtonText : colors.cardText,
                fontWeight: '600',
              }}
            >
              {album.name}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  button: {
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
