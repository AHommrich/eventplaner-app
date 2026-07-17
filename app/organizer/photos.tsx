import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GalleryAlbumPicker } from '../../components/gallery/GalleryAlbumPicker';
import {
  GalleryEmptyState,
  GalleryThumbnail,
  ZoomableGalleryImage,
} from '../../components/gallery/GalleryPrimitives';
import { ScreenGradient } from '../../components/ScreenGradient';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';
import { isManagementUploadableAlbum } from '../../lib/galleryAlbums';
import { useLanguage } from '../../lib/LanguageContext';
import { getActiveManagementEventId } from '../../lib/management';
import {
  deleteManagementPhoto,
  fetchManagementPhotos,
  ManagementPhoto,
  ManagementPhotoAlbum,
  uploadManagementPhoto,
} from '../../lib/managementPhotos';
import { useOrganizerStyles } from '../../lib/organizerStyles';
import { pickPhotoFromLibrary, takePhotoWithCamera } from '../../lib/photoPicker';

const TILE_GAP = theme.spacing.sm;
// Dense 3-column thumbnail grid to match the guest gallery (not a card list).
const TILE_SIZE = (Dimensions.get('window').width - theme.spacing.lg * 2 - TILE_GAP * 2) / 3;

export default function OrganizerPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const eventStyles = useOrganizerStyles();
  const [albums, setAlbums] = useState<ManagementPhotoAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ManagementPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!(await getActiveManagementEventId())) {
      router.replace('/organizer');
      return;
    }

    try {
      const available = [...(await fetchManagementPhotos())].sort(
        (first, second) => first.sort_order - second.sort_order
      );
      setAlbums(available);
      setSelectedAlbumId((current) =>
        current !== null && available.some((album) => album.id === current)
          ? current
          : (available[0]?.id ?? null)
      );
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumId) ?? null,
    [albums, selectedAlbumId]
  );
  const canUpload = !!selectedAlbum && isManagementUploadableAlbum(selectedAlbum.slug);

  function remove(photo: ManagementPhoto) {
    Alert.alert(t('organizer.photos.deleteTitle'), t('organizer.photos.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeletingId(photo.id);
          try {
            await deleteManagementPhoto(photo.id);
            setAlbums((current) =>
              current.map((album) => ({
                ...album,
                photos: album.photos.filter((item) => item.id !== photo.id),
              }))
            );
            setSelectedPhoto(null);
          } catch {
            Alert.alert(t('common.error'), t('organizer.photos.deleteFailed'));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  async function upload(source: 'camera' | 'library') {
    if (!selectedAlbum || !isManagementUploadableAlbum(selectedAlbum.slug)) return;
    const result = source === 'camera' ? await takePhotoWithCamera() : await pickPhotoFromLibrary();
    if (result && 'permissionDenied' in result) {
      Alert.alert(
        t('common.accessDenied'),
        source === 'camera' ? t('photos.cameraPermission') : t('photos.libraryPermission')
      );
      return;
    }
    if (!result) return;

    setUploading(true);
    setUploadProgress(null);
    try {
      await uploadManagementPhoto(selectedAlbum.id, result.uri, setUploadProgress);
      await load();
    } catch {
      Alert.alert(t('common.error'), t('organizer.photos.uploadFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function chooseUploadSource() {
    Alert.alert(t('organizer.photos.uploadPhoto'), selectedAlbum?.name ?? '', [
      { text: t('photos.camera'), onPress: () => void upload('camera') },
      { text: t('photos.fromLibrary'), onPress: () => void upload('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <View style={[styles.screen, eventStyles.screen]}>
      {variant.key === 'soft-luxury' && (
        <ScreenGradient screenBg={colors.screenBg} primary={colors.primary} />
      )}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + 110,
          gap: theme.spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <ThemedText style={[styles.title, eventStyles.title]}>
          {t('organizer.photos.title')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{t('organizer.photos.subtitle')}</ThemedText>

        {loading ? (
          <ActivityIndicator color={eventStyles.colors.cardText} />
        ) : failed ? (
          <TouchableOpacity style={[styles.card, eventStyles.card]} onPress={() => void load()}>
            <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
            <ThemedText style={styles.retry}>{t('common.retry')}</ThemedText>
          </TouchableOpacity>
        ) : albums.length === 0 ? (
          <GalleryEmptyState title={t('organizer.photos.noAlbums')} />
        ) : (
          <>
            <GalleryAlbumPicker
              albums={albums}
              selectedId={selectedAlbumId}
              onSelect={setSelectedAlbumId}
            />
            {selectedAlbum && (
              <View style={[styles.card, eventStyles.card]}>
                <View style={styles.albumHeader}>
                  <ThemedText style={[styles.cardTitle, eventStyles.title]}>
                    {selectedAlbum.name}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.count,
                      {
                        backgroundColor: eventStyles.colors.cardButton,
                        color: eventStyles.colors.cardButtonText,
                      },
                    ]}
                  >
                    {selectedAlbum.photos.length}
                  </ThemedText>
                </View>
                {selectedAlbum.photos.length === 0 ? (
                  <ThemedText style={styles.empty}>{t('organizer.photos.emptyAlbum')}</ThemedText>
                ) : (
                  <View style={styles.grid}>
                    {selectedAlbum.photos.map((photo) => (
                      <GalleryThumbnail
                        key={photo.id}
                        photo={photo}
                        size={TILE_SIZE}
                        radius={variant.radius.tile}
                        onPress={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </View>
                )}
                {!canUpload && (
                  <ThemedText style={styles.uploadHint}>
                    {t('organizer.photos.photoGameUploadHint')}
                  </ThemedText>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {canUpload && (
        <TouchableOpacity
          accessibilityLabel={t('organizer.photos.uploadPhoto')}
          onPress={chooseUploadSource}
          disabled={uploading}
          style={[
            styles.fab,
            {
              bottom: Math.max(insets.bottom, 10) + 84,
              backgroundColor: uploading ? theme.colors.muted : colors.fab,
            },
          ]}
        >
          {uploading ? (
            uploadProgress === null ? (
              <ActivityIndicator color={colors.fabIcon} />
            ) : (
              <ThemedText style={{ color: colors.fabIcon, fontWeight: '700' }}>
                {Math.round(uploadProgress * 100)}%
              </ThemedText>
            )
          ) : (
            <Ionicons name="camera" size={24} color={colors.fabIcon} />
          )}
        </TouchableOpacity>
      )}

      <Modal
        visible={selectedPhoto !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.detail}>
          {selectedPhoto && (
            <>
              <ZoomableGalleryImage uri={selectedPhoto.url} />
              <Pressable
                accessibilityLabel={t('a11y.closePhoto')}
                onPress={() => setSelectedPhoto(null)}
                style={[styles.close, { top: insets.top + theme.spacing.md }]}
              >
                <Ionicons name="close" size={30} color="#ffffff" />
              </Pressable>
              <View
                style={[styles.detailInfo, { paddingBottom: insets.bottom + theme.spacing.lg }]}
              >
                <ThemedText style={styles.detailText}>
                  {selectedPhoto.guest_name ??
                    selectedPhoto.uploaded_by ??
                    t('organizer.photos.unknown')}
                </ThemedText>
                {!!(selectedPhoto.task_description ?? selectedPhoto.description) && (
                  <ThemedText style={styles.detailText}>
                    {selectedPhoto.task_description ?? selectedPhoto.description}
                  </ThemedText>
                )}
                <TouchableOpacity
                  accessibilityLabel={t('organizer.photos.deletePhoto')}
                  onPress={() => remove(selectedPhoto)}
                  disabled={deletingId === selectedPhoto.id}
                  style={styles.deleteButton}
                >
                  {deletingId === selectedPhoto.id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#ffffff" />
                  )}
                  <ThemedText style={styles.deleteText}>
                    {t('organizer.photos.deletePhoto')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: theme.colors.muted, textAlign: 'center' },
  card: { padding: 0 },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  count: {
    minWidth: 28,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  photoCard: { width: TILE_SIZE, overflow: 'hidden' },
  photoInfo: { padding: theme.spacing.sm, minHeight: 54 },
  uploader: { fontSize: 13, fontWeight: '600' },
  description: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  empty: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  retry: { color: theme.colors.muted, textDecorationLine: 'underline', marginTop: 4 },
  uploadHint: { color: theme.colors.muted, marginTop: theme.spacing.md, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  detail: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  close: { position: 'absolute', right: theme.spacing.lg },
  detailInfo: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailText: { color: '#ffffff', textAlign: 'center' },
  deleteButton: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  deleteText: { color: '#ffffff', fontWeight: '700' },
});
