import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { GalleryAlbumPicker } from '../../components/gallery/GalleryAlbumPicker';
import { isHandledApiError } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { qk } from '../../lib/queryKeys';
import { useSessionScope } from '../../lib/SessionContext';
import { useRefetchOnFocus } from '../../lib/useRefetchOnFocus';
import { GalleryEmptyState, GalleryThumbnail } from '../../components/gallery/GalleryPrimitives';
import { PhotoLightbox } from '../../components/gallery/PhotoLightbox';
import { ScreenGradient } from '../../components/ScreenGradient';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useEventTheme } from '../../lib/EventThemeContext';
import { isManagementUploadableAlbum } from '../../lib/galleryAlbums';
import { useLanguage } from '../../lib/LanguageContext';
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
  const scope = useSessionScope();
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ManagementPhoto | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Albums are a cache-backed query (CP5), sorted by the backend `sort_order`.
  const photosQuery = useQuery(
    {
      queryKey: qk.managementPhotos(scope),
      queryFn: async ({ signal }) =>
        [...(await fetchManagementPhotos(signal))].sort((a, b) => a.sort_order - b.sort_order),
      enabled: scope?.actor === 'management',
    },
    queryClient
  );
  const albums = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const loading = photosQuery.isLoading;
  const refreshing = photosQuery.isRefetching;
  const failed = photosQuery.isError;

  /** Re-sync the albums query after an upload/delete. */
  const load = useCallback(async () => {
    await photosQuery.refetch();
  }, [photosQuery]);

  /** Optimistically patch the cached albums (e.g. after a delete). */
  function patchAlbums(updater: (prev: ManagementPhotoAlbum[]) => ManagementPhotoAlbum[]) {
    queryClient.setQueryData<ManagementPhotoAlbum[]>(qk.managementPhotos(scope), (prev) =>
      prev ? updater(prev) : prev
    );
  }

  // No bound event → no photo context; return to the organizer home.
  useFocusEffect(
    useCallback(() => {
      if (scope?.actor !== 'management') router.replace('/organizer');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope])
  );
  // Revalidate on focus only when stale, and only while the query is enabled
  // (a non-management scope redirects above — do not fire a photo fetch there).
  useRefetchOnFocus(photosQuery, scope?.actor === 'management');

  // Derive the effective album instead of syncing state in an effect: honour
  // the user's explicit pick while it still exists, else default to the first.
  const effectiveAlbumId =
    selectedAlbumId !== null && albums.some((album) => album.id === selectedAlbumId)
      ? selectedAlbumId
      : (albums[0]?.id ?? null);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === effectiveAlbumId) ?? null,
    [albums, effectiveAlbumId]
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
            patchAlbums((current) =>
              current.map((album) => ({
                ...album,
                photos: album.photos.filter((item) => item.id !== photo.id),
              }))
            );
            setSelectedPhoto(null);
          } catch (e) {
            if (isHandledApiError(e)) return;
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
    } catch (e) {
      if (isHandledApiError(e)) return;
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
          <RefreshControl refreshing={refreshing} onRefresh={() => void photosQuery.refetch()} />
        }
      >
        {loading ? (
          <ActivityIndicator color={eventStyles.colors.cardText} />
        ) : failed ? (
          <TouchableOpacity style={[styles.card, eventStyles.card]} onPress={() => void load()}>
            <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
            <ThemedText style={[styles.retry, eventStyles.muted]}>{t('common.retry')}</ThemedText>
          </TouchableOpacity>
        ) : albums.length === 0 ? (
          <GalleryEmptyState title={t('organizer.photos.noAlbums')} />
        ) : (
          <>
            <GalleryAlbumPicker
              albums={albums}
              selectedId={effectiveAlbumId}
              onSelect={setSelectedAlbumId}
            />
            {selectedAlbum && (
              <>
                {selectedAlbum.photos.length === 0 ? (
                  <ThemedText style={[styles.empty, eventStyles.muted]}>
                    {t('organizer.photos.emptyAlbum')}
                  </ThemedText>
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
                  <ThemedText style={[styles.uploadHint, eventStyles.muted]}>
                    {t('organizer.photos.photoGameUploadHint')}
                  </ThemedText>
                )}
              </>
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

      <PhotoLightbox
        visible={selectedPhoto !== null}
        photos={selectedAlbum?.photos ?? []}
        initialPhotoId={selectedPhoto?.id ?? null}
        onClose={() => setSelectedPhoto(null)}
        onPhotoChange={(photo) => setSelectedPhoto(photo)}
        closeLabel={t('a11y.closePhoto')}
        renderFooter={(photo) => (
          <>
            <ThemedText style={styles.detailText}>
              {photo.guest_name ?? photo.uploaded_by ?? t('organizer.photos.unknown')}
            </ThemedText>
            {!!(photo.task_description ?? photo.description) && (
              <ThemedText style={styles.detailText}>
                {photo.task_description ?? photo.description}
              </ThemedText>
            )}
            <TouchableOpacity
              accessibilityLabel={t('organizer.photos.deletePhoto')}
              onPress={() => remove(photo)}
              disabled={deletingId === photo.id}
              style={styles.deleteButton}
            >
              {deletingId === photo.id ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#ffffff" />
              )}
              <ThemedText style={styles.deleteText}>{t('organizer.photos.deletePhoto')}</ThemedText>
            </TouchableOpacity>
          </>
        )}
      />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, marginTop: theme.spacing.md },
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
