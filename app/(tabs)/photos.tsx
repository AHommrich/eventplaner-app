import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
        source={{ uri }}
        style={{ width: SCREEN_W, height: SCREEN_H * 0.8 }}
        resizeMode="contain"
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

const COLUMNS = 3;
const GAP = 2;
const TILE_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS + 1)) / COLUMNS;
const POLL_INTERVAL = 30_000;

export default function PhotosScreen() {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  async function fetchPhotos() {
    try {
      const res = await api.get<{ data: Photo[] }>('/api/photos');
      setPhotos(res.data.data);
    } catch {
      // silent — zeigt einfach alten Stand
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
      <View className="flex-1 bg-background items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLUMNS}
        contentContainerStyle={{ padding: GAP }}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-32">
            <Ionicons name="images-outline" size={48} color={theme.colors.muted} />
            <Text className="text-muted mt-3 text-base">{t('photos.empty')}</Text>
            <Text className="text-muted text-sm">{t('photos.beFirst')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            <Image
              source={{ uri: item.url }}
              style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: 2 }}
              resizeMode="cover"
            />
          </Pressable>
        )}
      />

      {/* Detail-Modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          {selected && <ZoomableImage key={selected.id} uri={selected.url} />}
          {selected && (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ color: '#fff', fontSize: 14, opacity: 0.7 }}>{selected.guest_name}</Text>
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

      {/* Upload-Button */}
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
          backgroundColor: uploading ? theme.colors.muted : theme.colors.accent,
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
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="camera" size={24} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}
