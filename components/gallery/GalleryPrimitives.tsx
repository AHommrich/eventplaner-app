import { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { ThemedText } from '../ThemedText';
import { theme } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type GalleryPhotoItem = {
  id: number;
  url: string;
};

export function GalleryThumbnail({
  photo,
  size,
  radius,
  onPress,
  unavailableLabel,
}: {
  photo: GalleryPhotoItem;
  size: number | string;
  radius: number;
  onPress: () => void;
  unavailableLabel: string;
}) {
  // Blob missing in object storage → static placeholder, not pressable.
  const [failed, setFailed] = useState(false);
  const box = { width: size as number, height: size as number, borderRadius: radius };

  if (failed) {
    return (
      <View
        testID={`photo-${photo.id}-unavailable`}
        accessible
        accessibilityLabel={unavailableLabel}
        style={[box, styles.unavailable]}
      >
        <Ionicons name="image-outline" size={24} color={theme.colors.muted} />
      </View>
    );
  }

  return (
    <Pressable testID={`photo-${photo.id}`} onPress={onPress}>
      <Image
        source={photo.url}
        style={box}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={String(photo.id)}
        onError={() => setFailed(true)}
      />
    </Pressable>
  );
}

export function ZoomableGalleryImage({
  uri,
  width = SCREEN_WIDTH,
  unavailableLabel,
}: {
  uri: string;
  width?: number;
  unavailableLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        accessible
        accessibilityLabel={unavailableLabel}
        style={[styles.unavailable, { width, height: SCREEN_HEIGHT * 0.8 }]}
      >
        <Ionicons name="image-outline" size={48} color={theme.colors.muted} />
        {!!unavailableLabel && (
          <ThemedText style={styles.emptySubtitle}>{unavailableLabel}</ThemedText>
        )}
      </View>
    );
  }

  return (
    <GestureScrollView
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ width, height: SCREEN_HEIGHT * 0.8 }}
    >
      <Image
        source={uri}
        style={{ width, height: SCREEN_HEIGHT * 0.8 }}
        contentFit="contain"
        cachePolicy="disk"
        onError={() => setFailed(true)}
      />
    </GestureScrollView>
  );
}

export function GalleryEmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View testID="photos-empty-state" style={styles.empty}>
      <Ionicons name="images-outline" size={48} color={theme.colors.muted} />
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      {!!subtitle && <ThemedText style={styles.emptySubtitle}>{subtitle}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 128 },
  emptyTitle: { color: theme.colors.muted, marginTop: 12, fontSize: 16 },
  emptySubtitle: { color: theme.colors.muted, fontSize: 14 },
  unavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
});
