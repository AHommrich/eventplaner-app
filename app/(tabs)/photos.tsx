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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  FlatList as GestureFlatList,
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from 'react-native-gesture-handler';
import { ThemedText } from '../../components/ThemedText';
import { PhotoGridSkeleton } from '../../components/ui/ScreenSkeletons';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { getSession } from '../../lib/auth';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { Toast } from '../../components/ui/Toast';
import { useConsentGate } from '../../components/ConsentGate';
import { hideGuestContent, PhotoReportReason, reportPhoto } from '../../lib/guest';
import { captureException } from '../../lib/monitoring';
import { haptics } from '../../lib/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Detail-modal image with pinch-to-zoom. `ScrollView` gives us that for free
 * on both iOS and Android without extra libraries.
 * `contentFit="contain"` prevents cropping when the image
 * aspect ratio doesn't match the viewport.
 */
function ZoomableImage({ uri, width = SCREEN_W }: { uri: string; width?: number }) {
  return (
    <GestureScrollView
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ width, height: SCREEN_H * 0.8 }}
    >
      <Image
        source={uri}
        style={{ width, height: SCREEN_H * 0.8 }}
        contentFit="contain"
        cachePolicy="disk"
      />
    </GestureScrollView>
  );
}

type Photo = {
  id: number;
  url: string;
  guest_id: number | null;
  guest_name: string;
  created_at: string;
};

type PhotoUploadResponse = Omit<Photo, 'guest_id'> & {
  guest_id?: number | null;
};

const REPORT_REASONS: PhotoReportReason[] = ['inappropriate_content', 'privacy', 'other'];

// --- Grid layout constants ---
const COLUMNS = 3;
const GAP = 2;
const TILE_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS + 1)) / COLUMNS;
const POLL_INTERVAL = 30_000;

const DETAIL_ITEM_W = SCREEN_W;
const DETAIL_SNAP = SCREEN_W;
const DETAIL_PEEK = 0;

export default function PhotosScreen() {
  const { t } = useLanguage();
  const { colors, loadTheme } = useEventTheme();
  const { ensureConsent } = useConsentGate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadToast, setUploadToast] = useState(false);
  const uploadToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentGuestId, setCurrentGuestId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [reportingPhoto, setReportingPhoto] = useState<Photo | null>(null);
  const [reportReason, setReportReason] = useState<PhotoReportReason>('inappropriate_content');
  const [reportMessage, setReportMessage] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [detailMounted, setDetailMounted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const { refreshing, refreshed, onRefresh } = useRefreshToast(async () => {
    await fetchPhotos();
    loadTheme();
  });

  const dragY = useSharedValue(0);
  const entryOpacity = useSharedValue(0);

  const rootAnimatedStyle = useAnimatedStyle(() => ({ opacity: entryOpacity.value }));
  // Scrim fades out while dragging (both directions) so the gallery shows through
  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [-300, 0, 300], [0, 1, 0], Extrapolation.CLAMP),
  }));
  const photoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      {
        scale: interpolate(dragY.value, [-300, 0, 300], [0.88, 1, 0.88], Extrapolation.CLAMP),
      },
    ],
  }));

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
      setLoadError(false);
    } catch {
      // Silent when we already have photos to show — retain the previous
      // list, next poll or pull will retry. Only surface an error banner on
      // the very first load, where there's nothing to fall back to.
      if (photos.length === 0) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPhotos();
    getSession().then((session) => setCurrentGuestId(session?.guestId ?? null));
    intervalRef.current = setInterval(fetchPhotos, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Mount-once effect — `fetchPhotos` now reads `photos.length` for the
    // load-error gate, which makes it a "changing" dependency by identity,
    // but re-running this effect per render would reset the poll interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setUploadProgress(null);
    try {
      const res = await api.post<PhotoUploadResponse>('/api/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
        onUploadProgress: (e) => {
          setUploadProgress(e.total ? e.loaded / e.total : null);
        },
      });
      const session = await getSession();
      const uploadedPhoto: Photo = {
        ...res.data,
        guest_id: res.data.guest_id ?? session?.guestId ?? null,
      };
      setPhotos((prev) => [uploadedPhoto, ...prev]);
      haptics.success();
      setUploadToast(true);
      if (uploadToastTimer.current) clearTimeout(uploadToastTimer.current);
      uploadToastTimer.current = setTimeout(() => setUploadToast(false), 2000);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? t('common.unknownError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setUploading(false);
      setUploadProgress(null);
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

  const doCloseDetail = useCallback(() => {
    setSelected(null);
    setReportingPhoto(null);
    setReportError(null);
    setDetailMounted(false);
    cancelAnimation(dragY);
    cancelAnimation(entryOpacity);
    dragY.value = 0;
    entryOpacity.value = 0;
  }, [dragY, entryOpacity]);

  const handleClosePress = useCallback(() => {
    entryOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(doCloseDetail)();
    });
  }, [entryOpacity, doCloseDetail]);

  // Swipe-down or swipe-up to dismiss. useMemo avoids recreating the gesture
  // on every render; it only rebuilds when reportingPhoto changes (enabled
  // flag). `activeOffsetY`/`failOffsetX` replicate the old PanResponder's
  // vertical-dominant capture rule so the horizontal pager keeps its swipes.
  // `simultaneousWithExternalGesture` needs a real `Gesture` object (a ref to
  // the FlatList itself does NOT work: only components built via
  // `createNativeWrapper`, e.g. gesture-handler's `ScrollView`, get a
  // `handlerTag` stamped onto their ref — gesture-handler's `FlatList` wrapper
  // just forwards the ref straight to RN's FlatList, so that ref never
  // resolves to a valid handler and the relation silently no-ops). Instead we
  // wrap the FlatList in its own `GestureDetector` with a plain
  // `Gesture.Native()` and relate the pan to *that* gesture object directly.
  const nativeListGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!reportingPhoto)
        .activeOffsetY([-12, 12])
        .failOffsetX([-15, 15])
        .simultaneousWithExternalGesture(nativeListGesture)
        .onUpdate((e) => {
          dragY.value = e.translationY;
        })
        .onEnd((e) => {
          // PanResponder's `vy` was px/ms; gesture-handler's `velocityY` is
          // px/s — thresholds are scaled up by 1000x accordingly.
          const flickDown = e.velocityY > 1200 || e.translationY > 120;
          const flickUp = e.velocityY < -1200 || e.translationY < -80;
          if (flickDown || flickUp) {
            const target = flickDown ? SCREEN_H : -SCREEN_H;
            runOnJS(haptics.impactLight)();
            dragY.value = withTiming(target, { duration: 220 }, (finished) => {
              if (finished) runOnJS(doCloseDetail)();
            });
          } else {
            dragY.value = withSpring(0, { damping: 14, stiffness: 120 });
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportingPhoto]
  );

  // Open animation + initial scroll when detail mounts
  useEffect(() => {
    if (!detailMounted || !selected) return;
    entryOpacity.value = 0;
    dragY.value = 0;
    entryOpacity.value = withTiming(1, { duration: 120 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailMounted]);

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
      doCloseDetail();
      haptics.success();
      Alert.alert(t('photos.reportSuccess'));
    } catch (e: any) {
      if (e?.response?.status === 429) {
        Alert.alert(t('photos.reportRateLimited'));
      } else if (e?.response?.status === 422) {
        setReportError(t('photos.reportValidationError'));
      } else {
        captureException(e);
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
      doCloseDetail();
      haptics.success();
      Alert.alert(t('photos.hideUploaderSuccess', { name: photo.guest_name }));
    } catch (e: any) {
      if (e?.response?.status !== 422) captureException(e);
      const message =
        e?.response?.status === 422 ? t('common.notPossible') : t('common.unknownError');
      Alert.alert(t('common.error'), message);
    }
  }

  function confirmDeletePhoto(photo: Photo) {
    Alert.alert(t('photos.deleteTitle'), t('photos.deleteDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('photos.deletePhoto'),
        style: 'destructive',
        onPress: () => deletePhoto(photo),
      },
    ]);
  }

  async function deletePhoto(photo: Photo) {
    try {
      await api.delete(`/api/photos/${photo.id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      doCloseDetail();
      haptics.success();
      Alert.alert(t('photos.deleteSuccess'));
    } catch (e) {
      captureException(e);
      Alert.alert(t('common.error'), t('photos.deleteError'));
    }
  }

  const selectedIndex = selected
    ? Math.max(
        photos.findIndex((p) => p.id === selected.id),
        0
      )
    : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screenBg, paddingTop: insets.top + GAP }}>
        <PhotoGridSkeleton />
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
        ListHeaderComponent={
          loadError ? (
            <ErrorBanner
              message={t('common.loadFailed')}
              onRetry={fetchPhotos}
              style={{ margin: GAP }}
            />
          ) : null
        }
        ListEmptyComponent={
          loadError ? null : (
            <View testID="photos-empty-state" className="flex-1 items-center justify-center mt-32">
              <Ionicons name="images-outline" size={48} color={theme.colors.muted} />
              <ThemedText className="text-muted mt-3 text-base">{t('photos.empty')}</ThemedText>
              <ThemedText className="text-muted text-sm">{t('photos.beFirst')}</ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`photo-${item.id}`}
            onPress={() => {
              setDetailMounted(true);
              setSelected(item);
            }}
          >
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
      {!uploadToast && <RefreshToast visible={refreshed} refreshing={refreshing} />}

      {/* Detail overlay — absolutely positioned in the same view hierarchy so
          the gallery renders beneath it (no black UIViewController background). */}
      <Modal
        visible={detailMounted}
        transparent
        animationType="none"
        onRequestClose={handleClosePress}
        statusBarTranslucent
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, rootAnimatedStyle]}>
          {/* Scrim — semi-transparent so the gallery shows through but
              controls remain legible; fades out while swiping to dismiss */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(0,0,0,0.25)' },
              scrimAnimatedStyle,
            ]}
            pointerEvents="none"
          />
          {/* Pan gesture wrapper */}
          <GestureDetector gesture={panGesture}>
            <View style={StyleSheet.absoluteFillObject}>
              {/* ── Photo pager ─────────────────────────────────────────────
                Only the photo gets the fly-off transform so the controls
                stay pinned when the user swipes to dismiss.              */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  { justifyContent: 'center' },
                  photoAnimatedStyle,
                ]}
              >
                {selected && (
                  <GestureDetector gesture={nativeListGesture}>
                    <GestureFlatList
                      testID="photo-detail-pager"
                      data={photos}
                      horizontal
                      pagingEnabled
                      initialScrollIndex={selectedIndex}
                      getItemLayout={(_, index) => ({
                        length: DETAIL_ITEM_W,
                        offset: DETAIL_SNAP * index,
                        index,
                      })}
                      keyExtractor={(item) => String(item.id)}
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(event) => {
                        const raw = event.nativeEvent.contentOffset.x;
                        const nextIndex = Math.max(
                          0,
                          Math.min(Math.round((raw + DETAIL_PEEK) / DETAIL_SNAP), photos.length - 1)
                        );
                        const nextPhoto = photos[nextIndex];
                        if (nextPhoto && selected && nextPhoto.id !== selected.id) {
                          setSelected(nextPhoto);
                          setReportingPhoto(null);
                          setReportError(null);
                        }
                      }}
                      onScrollToIndexFailed={() => undefined}
                      renderItem={({ item }) => (
                        <ZoomableImage uri={item.url} width={DETAIL_ITEM_W} />
                      )}
                      style={{ width: SCREEN_W, height: SCREEN_H * 0.8, flexGrow: 0 }}
                    />
                  </GestureDetector>
                )}
              </Animated.View>

              {/* ── Close button ──────────────────────────────────────────── */}
              <Pressable
                onPress={handleClosePress}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.closePhoto')}
                style={{ position: 'absolute', top: insets.top + 12, right: 20 }}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>

              {/* ── Info + action buttons ─────────────────────────────────
                Positioned absolutely at the bottom — no transform, so
                they stay put while the photo flies off.                  */}
              {selected && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: insets.bottom + 28,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <ThemedText
                    style={{
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: '600',
                      textShadowColor: 'rgba(0,0,0,0.6)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 4,
                    }}
                  >
                    {selected.guest_name}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {selected.guest_id === currentGuestId ? (
                      <Pressable
                        testID="delete-photo-button"
                        onPress={() => confirmDeletePhoto(selected)}
                        style={styles.detailBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.cardButtonText} />
                        <ThemedText style={{ color: colors.cardButtonText, fontSize: 13 }}>
                          {t('photos.deletePhoto')}
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <Pressable
                        testID="report-photo-button"
                        onPress={() => openReport(selected)}
                        style={styles.detailBtn}
                      >
                        <Ionicons name="flag-outline" size={16} color={colors.cardButtonText} />
                        <ThemedText style={{ color: colors.cardButtonText, fontSize: 13 }}>
                          {t('photos.report')}
                        </ThemedText>
                      </Pressable>
                    )}
                    {selected.guest_id !== null && selected.guest_id !== currentGuestId && (
                      <Pressable
                        testID="hide-uploader-button"
                        onPress={() => confirmHideUploader(selected)}
                        style={styles.detailBtn}
                      >
                        <Ionicons name="eye-off-outline" size={16} color={colors.cardButtonText} />
                        <ThemedText style={{ color: colors.cardButtonText, fontSize: 13 }}>
                          {t('photos.hideUploader')}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* ── Report sheet ──────────────────────────────────────────── */}
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
                  <ThemedText
                    style={{
                      color: colors.cardText + '88',
                      fontSize: 12,
                      textAlign: 'right',
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    {reportMessage.length}/1000
                  </ThemedText>
                  {reportError && (
                    <ThemedText
                      style={{
                        color: theme.colors.error,
                        fontSize: 13,
                        marginTop: theme.spacing.xs,
                      }}
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
          </GestureDetector>
        </Animated.View>
      </Modal>

      {/* Upload FAB — hidden while detail is open (Modal covers it anyway,
          but explicit hide prevents accessibility issues). */}
      <Pressable
        onPress={showUploadOptions}
        disabled={uploading || detailMounted}
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
          uploadProgress != null ? (
            <ThemedText style={{ color: colors.cardText, fontSize: 13, fontWeight: '700' }}>
              {Math.round(uploadProgress * 100)}%
            </ThemedText>
          ) : (
            <ActivityIndicator color={colors.cardText} size="small" />
          )
        ) : (
          <Ionicons name="camera" size={24} color={colors.fabIcon} />
        )}
      </Pressable>
      <Toast visible={uploadToast}>
        <ThemedText style={{ color: colors.cardButtonText, fontSize: 14, fontWeight: '700' }}>
          ✓ {t('photos.uploadSuccess')}
        </ThemedText>
      </Toast>
    </View>
  );
}

const styles = StyleSheet.create({
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
});
