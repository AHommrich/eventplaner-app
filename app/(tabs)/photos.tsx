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
 * Detail modal: tap a thumbnail → dark full-screen modal with a horizontally
 * swipeable pager. Each page keeps the same zoomable `ScrollView`
 * (`maximumZoomScale=4`) at cover-fit resolution.
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
  TextInput,
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
import { useConsentGate } from '../../components/ConsentGate';
import { hideGuestContent, PhotoReportReason, reportPhoto } from '../../lib/guest';

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
  guest_id: number | null;
  guest_name: string;
  created_at: string;
};

const REPORT_REASONS: PhotoReportReason[] = ['inappropriate_content', 'privacy', 'other'];

// --- Grid layout constants ---
const COLUMNS = 3;
const GAP = 2;
const TILE_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS + 1)) / COLUMNS;
const POLL_INTERVAL = 30_000;

export default function PhotosScreen() {
  const { t } = useLanguage();
  const { colors, loadTheme } = useEventTheme();
  const { ensureConsent } = useConsentGate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [reportingPhoto, setReportingPhoto] = useState<Photo | null>(null);
  const [reportReason, setReportReason] = useState<PhotoReportReason>('inappropriate_content');
  const [reportMessage, setReportMessage] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const { refreshing, refreshed, onRefresh } = useRefreshToast(async () => {
    await fetchPhotos();
    loadTheme();
  });

  /**
   * Load the photo list from the backend. Swallows errors on purpose:
   * `fetchPhotos` is called both by the initial mount effect AND by the
   * 30-second polling interval, so a transient network hiccup should not
   * pop an alert or clear the currently-rendered list. The next poll or a
   * pull-to-refresh retries.
   */
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
    const jpeg = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
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

  /**
   * Library picker path. Runs the OS permission dialog on first tap; on
   * refusal we surface the localised message rather than silently ignoring
   * (the guest may have blocked permission at OS level and needs to know).
   * On successful pick we hand the URI to `uploadAsset` — which owns the
   * multipart body construction.
   */
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

  /**
   * Camera path. Same permission + upload shape as `handleUpload`, but
   * `launchCameraAsync` instead of `launchImageLibraryAsync`. Kept as a
   * separate function rather than parameterised so the intent is obvious
   * at the call site and the two permission strings stay distinct.
   */
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

  /**
   * FAB tap handler. Gates the whole upload flow behind the
   * `photo_upload` consent (Art. 6/7 (a) — see `docs/showcase/dsgvo-first.md`)
   * and then presents a native alert with camera + library options. When
   * consent is already granted `ensureConsent` resolves synchronously and
   * the alert appears without a modal in between, so returning guests see
   * no friction.
   */
  async function showUploadOptions() {
    if (!(await ensureConsent('photo_upload'))) return;
    Alert.alert(t('photos.addPhoto'), '', [
      { text: t('photos.camera'), onPress: handleCamera },
      { text: t('photos.fromLibrary'), onPress: handleUpload },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function closePhotoDetail() {
    setSelected(null);
    setReportingPhoto(null);
    setReportError(null);
  }

  function openReport(photo: Photo) {
    setReportReason('inappropriate_content');
    setReportMessage('');
    setReportError(null);
    setReportingPhoto(photo);
  }

  async function submitReport() {
    if (!reportingPhoto || submittingReport) return;
    setSubmittingReport(true);
    setReportError(null);
    const message = reportMessage.trim();
    try {
      await reportPhoto(reportingPhoto.id, {
        reason: reportReason,
        ...(message ? { message } : {}),
      });
      setPhotos((prev) => prev.filter((p) => p.id !== reportingPhoto.id));
      setSelected(null);
      setReportingPhoto(null);
      Alert.alert(t('photos.reportSuccess'));
    } catch (e: any) {
      if (e?.response?.status === 429) {
        Alert.alert(t('photos.reportRateLimited'));
      } else if (e?.response?.status === 422) {
        setReportError(t('photos.reportValidationError'));
      } else {
        Alert.alert(t('common.error'), t('photos.reportNetworkError'));
      }
    } finally {
      setSubmittingReport(false);
    }
  }

  function confirmHideUploader(photo: Photo) {
    if (photo.guest_id === null) return;
    Alert.alert(
      t('photos.hideUploaderTitle'),
      t('photos.hideUploaderDescription', { name: photo.guest_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('photos.hideUploader'),
          style: 'destructive',
          onPress: () => hideUploader(photo),
        },
      ]
    );
  }

  async function hideUploader(photo: Photo) {
    if (photo.guest_id === null) return;
    try {
      await hideGuestContent(photo.guest_id);
      setPhotos((prev) => prev.filter((p) => p.guest_id !== photo.guest_id));
      setSelected(null);
      Alert.alert(t('photos.hideUploaderSuccess', { name: photo.guest_name }));
    } catch (e: any) {
      const message =
        e?.response?.status === 422 ? t('common.notPossible') : t('common.unknownError');
      Alert.alert(t('common.error'), message);
    }
  }

  const selectedIndex = selected
    ? Math.max(
        photos.findIndex((photo) => photo.id === selected.id),
        0
      )
    : 0;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.screenBg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: insets.top,
        }}
      >
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tabTint}
            colors={[colors.tabTint]}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-32">
            <Ionicons name="images-outline" size={48} color={theme.colors.muted} />
            <ThemedText className="text-muted mt-3 text-base">{t('photos.empty')}</ThemedText>
            <ThemedText className="text-muted text-sm">{t('photos.beFirst')}</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`photo-${item.id}`} onPress={() => setSelected(item)}>
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
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={closePhotoDetail}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          {selected && (
            <FlatList
              testID="photo-detail-pager"
              data={photos}
              horizontal
              pagingEnabled
              initialScrollIndex={selectedIndex}
              getItemLayout={(_, index) => ({
                length: SCREEN_W,
                offset: SCREEN_W * index,
                index,
              })}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_W);
                const nextPhoto = photos[nextIndex];
                if (nextPhoto && nextPhoto.id !== selected.id) {
                  setSelected(nextPhoto);
                  setReportingPhoto(null);
                  setReportError(null);
                }
              }}
              onScrollToIndexFailed={() => undefined}
              renderItem={({ item }) => <ZoomableImage uri={item.url} />}
              style={{ width: SCREEN_W, height: SCREEN_H * 0.8, flexGrow: 0 }}
            />
          )}
          {selected && (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <ThemedText style={{ color: '#fff', fontSize: 14, opacity: 0.7 }}>
                {selected.guest_name}
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: theme.spacing.md }}>
                <Pressable
                  testID="report-photo-button"
                  onPress={() => openReport(selected)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.35)',
                    borderRadius: theme.borderRadius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <Ionicons name="flag-outline" size={16} color="#fff" />
                  <ThemedText style={{ color: '#fff', fontSize: 13 }}>
                    {t('photos.report')}
                  </ThemedText>
                </Pressable>
                {selected.guest_id !== null && (
                  <Pressable
                    testID="hide-uploader-button"
                    onPress={() => confirmHideUploader(selected)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.35)',
                      borderRadius: theme.borderRadius.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                    }}
                  >
                    <Ionicons name="eye-off-outline" size={16} color="#fff" />
                    <ThemedText style={{ color: '#fff', fontSize: 13 }}>
                      {t('photos.hideUploader')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}
          <Pressable
            onPress={closePhotoDetail}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.closePhoto')}
            style={{ position: 'absolute', top: insets.top + 12, right: 20 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {reportingPhoto && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.card,
                borderTopLeftRadius: theme.borderRadius.lg,
                borderTopRightRadius: theme.borderRadius.lg,
                padding: theme.spacing.lg,
                paddingBottom: insets.bottom + theme.spacing.lg,
              }}
            >
              <ThemedText
                style={{
                  color: colors.cardText,
                  fontSize: 18,
                  fontWeight: '700',
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t('photos.reportTitle')}
              </ThemedText>
              <ThemedText
                style={{ color: colors.cardText, fontSize: 14, marginBottom: theme.spacing.md }}
              >
                {t('photos.reportDescription')}
              </ThemedText>

              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => setReportReason(reason)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <Ionicons
                    name={reportReason === reason ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={colors.cardText}
                  />
                  <ThemedText style={{ color: colors.cardText, fontSize: 15 }}>
                    {t(`photos.reason.${reason}`)}
                  </ThemedText>
                </Pressable>
              ))}

              <TextInput
                value={reportMessage}
                onChangeText={(text) => {
                  setReportMessage(text.slice(0, 1000));
                  setReportError(null);
                }}
                placeholder={t('photos.reportMessagePlaceholder')}
                placeholderTextColor={colors.cardText + '88'}
                multiline
                maxLength={1000}
                style={{
                  minHeight: 84,
                  borderWidth: 1,
                  borderColor: reportError ? theme.colors.error : colors.border + '66',
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  marginTop: theme.spacing.md,
                  color: colors.cardText,
                  textAlignVertical: 'top',
                }}
              />
              {reportError && (
                <ThemedText
                  style={{ color: theme.colors.error, fontSize: 13, marginTop: theme.spacing.xs }}
                >
                  {reportError}
                </ThemedText>
              )}

              <Pressable
                onPress={submitReport}
                disabled={submittingReport}
                style={{
                  marginTop: theme.spacing.lg,
                  backgroundColor: colors.cardButton,
                  borderRadius: theme.borderRadius.md,
                  paddingVertical: theme.spacing.md,
                  alignItems: 'center',
                  opacity: submittingReport ? 0.65 : 1,
                }}
              >
                <ThemedText style={{ color: colors.cardButtonText, fontWeight: '700' }}>
                  {t('photos.reportSubmit')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setReportingPhoto(null)}
                style={{ paddingVertical: theme.spacing.md, alignItems: 'center' }}
              >
                <ThemedText style={{ color: colors.cardText }}>{t('common.cancel')}</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Upload FAB — camera icon that swaps to a spinner during upload. */}
      <Pressable
        onPress={showUploadOptions}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.uploadPhoto')}
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
