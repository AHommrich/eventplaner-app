/**
 * Photo gallery — shared wedding album.
 *
 * Grid: 3-column FlatList of thumbnails with 2 px gutters. Auto-refreshes
 * every 30 s so photos posted by other guests appear without needing a
 * manual pull. Pull-to-refresh is also available and shares the same fetch
 * function.
 *
 * Upload: FAB in the bottom-right → Alert with "Camera" / "From library"
 * options. Every asset is transcoded to JPEG at 80 % quality via
 * `ImageManipulator.manipulateAsync` (empty transform list, format+compress
 * only) so the backend never has to deal with HEIC. Multipart body is built
 * manually because axios' default JSON serialisation would corrupt the file.
 *
 * Detail modal: tap a thumbnail → dark full-screen modal with a zoomable
 * `ScrollView` (`maximumZoomScale=4`) that renders the same URI at cover-fit
 * resolution.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Detail-modal image with pinch-to-zoom. `ScrollView` gives us that for free
 * on both iOS and Android without pulling in `react-native-gesture-handler`
 * for one screen. `contentFit="contain"` prevents cropping when the image
 * aspect ratio doesn't match the viewport.
 */
function ZoomableImage({ uri }: { uri: string }) {
  return (
    <ScrollView
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ width: SCREEN_W, height: SCREEN_H * 0.8 }}
    >
      <Image
        source={uri}
        style={{ width: SCREEN_W, height: SCREEN_H * 0.8 }}
        contentFit="contain"
        cachePolicy="disk"
      />
    </ScrollView>
  );
}

type Photo = {
  id: number;
  url: string;
  guest_name: string;
  created_at: string;
};

// --- Grid layout constants ---
const COLUMNS = 3;
const GAP = 2;
const TILE_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS + 1)) / COLUMNS;
const POLL_INTERVAL = 30_000;

export default function PhotosScreen() {
  const { t } = useLanguage();
  const { colors, loadTheme } = useEventTheme();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const { refreshing, refreshed, onRefresh } = useRefreshToast(async () => { await fetchPhotos(); loadTheme(); });

  async function fetchPhotos() {
    try {
      const res = await api.get<{ data: Photo[] }>('/api/photos');
      setPhotos(res.data.data);
    } catch {
      // Silent — retain the previous list, next poll or pull will retry.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPhotos();
    intervalRef.current = setInterval(fetchPhotos, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /**
   * Multipart upload of a single asset. `transformRequest: data => data`
   * disables axios' JSON serialisation so React Native's fetch layer forwards
   * the FormData verbatim. The optimistic prepend into the local list means
   * the new photo appears at the top before the backend even confirms.
   */
  async function uploadAsset(uri: string) {
    const jpeg = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const formData = new FormData();
    formData.append('photo', {
      uri: jpeg.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);
    setUploading(true);
    try {
      const res = await api.post<Photo>('/api/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
      });
      setPhotos((prev) => [res.data, ...prev]);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? t('common.unknownError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('common.accessDenied'), t('photos.libraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    if (result.canceled) return;
    await uploadAsset(result.assets[0].uri);
  }

  async function handleCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('common.accessDenied'), t('photos.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });
    if (result.canceled) return;
    await uploadAsset(result.assets[0].uri);
  }

  function showUploadOptions() {
    Alert.alert(t('photos.addPhoto'), '', [
      { text: t('photos.camera'), onPress: handleCamera },
      { text: t('photos.fromLibrary'), onPress: handleUpload },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screenBg, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, paddingTop: insets.top }}>
      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLUMNS}
        contentContainerStyle={{ padding: GAP }}
        columnWrapperStyle={{ gap: GAP }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tabTint} colors={[colors.tabTint]} />}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-32">
            <Ionicons name="images-outline" size={48} color={theme.colors.muted} />
            <ThemedText className="text-muted mt-3 text-base">{t('photos.empty')}</ThemedText>
            <ThemedText className="text-muted text-sm">{t('photos.beFirst')}</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            <Image
              source={item.url}
              style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: 2 }}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={String(item.id)}
            />
          </Pressable>
        )}
      />
      <RefreshToast visible={refreshed} refreshing={refreshing} />

      {/* Detail modal — fades in and out so the transition doesn't clash with
          the FlatList scroll position. */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          {selected && <ZoomableImage key={selected.id} uri={selected.url} />}
          {selected && (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <ThemedText style={{ color: '#fff', fontSize: 14, opacity: 0.7 }}>{selected.guest_name}</ThemedText>
            </View>
          )}
          <Pressable
            onPress={() => setSelected(null)}
            style={{ position: 'absolute', top: insets.top + 12, right: 20 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* Upload FAB — camera icon that swaps to a spinner during upload. */}
      <Pressable
        onPress={showUploadOptions}
        disabled={uploading}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: uploading ? theme.colors.muted : colors.fab,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        {uploading ? (
          <ActivityIndicator color={colors.cardText} size="small" />
        ) : (
          <Ionicons name="camera" size={24} color={colors.fabIcon} />
        )}
      </Pressable>
    </View>
  );
}
