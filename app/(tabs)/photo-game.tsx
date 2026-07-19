/**
 * Photo-game tab — a small "scavenger hunt" style feature where each guest
 * gets exactly one photo task and uploads a matching picture.
 *
 * Four-state finite automaton (drives `renderContent()`):
 *
 *   ended / draft ....... game is off (or over) → show the ended card.
 *   no_assignment ....... guest has never asked for a task → show the
 *                          "get task" card + button.
 *   assigned ............ guest has a task but no submission → show the
 *                          task text + "upload photo" button.
 *   submitted ........... task + uploaded photo shown; the button becomes
 *                          "replace photo" so the guest can retry until
 *                          they are happy.
 *
 * State transitions are optimistic — after `assign` we synthesise the new
 * assignment locally so the guest sees the task immediately; the next
 * `loadStatus` re-sync is only needed on the 409 recovery path (task already
 * assigned on the server side).
 */
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { FadeInView } from '../../components/FadeInView';
import { ThemedText } from '../../components/ThemedText';
import { CardSkeleton } from '../../components/ui/ScreenSkeletons';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { haptics } from '../../lib/haptics';
import { useRefetchOnFocus } from '../../lib/useRefetchOnFocus';
import { isHandledApiError } from '../../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';
import { useEventTheme } from '../../lib/EventThemeContext';
import { useRefreshToast } from '../../lib/useRefreshToast';
import { RefreshToast } from '../../components/RefreshToast';
import { useConsentGate } from '../../components/ConsentGate';
import {
  fetchPhotoGameStatus,
  assignPhotoGameTask,
  submitPhotoGamePhoto,
  PhotoGameStatusResponse,
} from '../../lib/guest';
import { queryClient } from '../../lib/queryClient';
import { qk } from '../../lib/queryKeys';
import { useSessionScope } from '../../lib/SessionContext';
import { theme } from '../../constants/theme';
import { cardSurfaceStyle } from '../../lib/variantStyles';
import { GradientFill } from '../../components/GradientFill';
import { ScreenGradient } from '../../components/ScreenGradient';

export default function PhotoGameScreen() {
  const { t } = useLanguage();
  const { colors, variant } = useEventTheme();
  const scope = useSessionScope();
  const isSoft = variant.key === 'soft-luxury';
  const softCard = cardSurfaceStyle(variant, colors.card, colors.border);
  const { ensureConsent } = useConsentGate();
  const insets = useSafeAreaInsets();
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // `actionError` holds assign/submit failures; a load failure is derived from
  // the query below. The inline error card shows whichever is present.
  const [actionError, setActionError] = useState<string | null>(null);

  // Photo-game status is a cache-backed query (CP4); the four-state UI reads
  // `statusData`. Errors surface inline in the screen's error card.
  const statusQuery = useQuery(
    {
      queryKey: qk.photoGameStatus(scope),
      queryFn: ({ signal }) => fetchPhotoGameStatus(signal),
      enabled: scope !== null,
    },
    queryClient
  );
  const statusData = statusQuery.data ?? null;
  const loading = statusQuery.isLoading;
  const loadErr = statusQuery.error as any;
  const error =
    actionError ??
    (statusQuery.isError
      ? (loadErr?.response?.data?.message ?? loadErr?.message ?? t('common.unknownError'))
      : null);

  /** Re-sync the shared status query (focus, refresh, retry, 409 recovery). */
  const loadStatus = useCallback(async () => {
    await statusQuery.refetch();
  }, [statusQuery]);

  /** Optimistically patch the cached status without a follow-up fetch. */
  function patchStatus(updater: (prev: PhotoGameStatusResponse) => PhotoGameStatusResponse) {
    queryClient.setQueryData<PhotoGameStatusResponse>(qk.photoGameStatus(scope), (prev) =>
      prev ? updater(prev) : prev
    );
  }

  useRefetchOnFocus(statusQuery);

  const { refreshing, refreshed, onRefresh } = useRefreshToast(loadStatus);

  /**
   * Ask the backend for a fresh task. Optimistically synthesise the returned
   * assignment into `statusData` so the UI updates without a follow-up
   * fetch. 409 means the server already had one for us — re-sync via
   * `loadStatus` picks up the existing assignment.
   */
  async function handleAssign() {
    setAssigning(true);
    setActionError(null);
    try {
      const result = await assignPhotoGameTask();
      patchStatus((prev) => ({
        ...prev,
        assignment: { id: result.id, task: result.task, submitted_at: null, photo_url: null },
      }));
      haptics.success();
    } catch (e: any) {
      if (isHandledApiError(e)) return;
      if (e?.response?.status === 409) {
        await loadStatus();
      } else {
        setActionError(e?.response?.data?.message ?? e?.message ?? t('common.unknownError'));
      }
    } finally {
      setAssigning(false);
    }
  }

  /** Two-source picker: camera or library. Both feed into `pickAndSubmit`. */
  async function handleUpload() {
    // GDPR Art. 6/7 (a) explicit consent gate — see photos.tsx for shape.
    if (!(await ensureConsent('photo_game'))) return;
    Alert.alert(t('photoGame.uploadButton'), undefined, [
      {
        text: t('photos.camera'),
        onPress: () => pickAndSubmit('camera'),
      },
      {
        text: t('photos.fromLibrary'),
        onPress: () => pickAndSubmit('library'),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  /**
   * Shared pick-and-submit path.
   *
   * `ImageManipulator.manipulateAsync` with no transforms + `compress: 0.8`
   * transcodes any HEIC/PNG into a JPEG the backend can accept without
   * server-side conversion. The empty transform array is intentional — the
   * whole point is just the format+quality change.
   */
  async function pickAndSubmit(source: 'camera' | 'library') {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('common.error'), t('photos.cameraPermission'));
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('common.error'), t('photos.libraryPermission'));
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const jpeg = await ImageManipulator.manipulateAsync(result.assets[0].uri, [], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    setUploading(true);
    setUploadProgress(null);
    setActionError(null);
    try {
      const submitted = await submitPhotoGamePhoto(jpeg.uri, setUploadProgress);
      patchStatus((prev) =>
        prev.assignment
          ? {
              ...prev,
              assignment: {
                ...prev.assignment,
                photo_url: submitted.photo_url,
                submitted_at: submitted.submitted_at,
              },
            }
          : prev
      );
      haptics.success();
    } catch (e: any) {
      if (isHandledApiError(e)) return;
      if (e?.response?.status === 409) {
        await loadStatus();
      } else {
        setActionError(e?.response?.data?.message ?? e?.message ?? t('common.unknownError'));
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  if (loading && !statusData) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.screenBg, paddingHorizontal: theme.spacing.lg },
        ]}
      >
        <View style={{ paddingTop: insets.top + theme.spacing.lg }}>
          <CardSkeleton lines={2} showButton />
        </View>
      </View>
    );
  }

  const status = statusData?.status;
  const assignment = statusData?.assignment ?? null;
  const isSubmitted = !!assignment?.submitted_at;
  const isDraft = status === 'draft';
  const isEnded = status === 'ended' || isDraft;

  function uploadingLabel(): string {
    if (uploadProgress != null) {
      return t('photoGame.uploadingProgress', { pct: Math.round(uploadProgress * 100) });
    }
    return t('photoGame.uploading');
  }

  /**
   * 4-way switch (see file header for the FSM). The order is important:
   * `ended` beats everything (so a submitted photo from a since-ended game
   * still shows the ended card), then `submitted`, then `assigned`, then the
   * default "get task" card.
   */
  function renderContent() {
    if (isEnded) {
      return (
        <View
          style={[
            styles.card,
            isSoft ? softCard : { backgroundColor: colors.card, borderColor: colors.border + '33' },
          ]}
        >
          <Ionicons
            name={isDraft ? 'hourglass-outline' : 'time-outline'}
            size={32}
            color={colors.cardText}
            style={{ marginBottom: theme.spacing.sm }}
          />
          <ThemedText style={[styles.cardTitle, { color: colors.cardText }]}>
            {isDraft ? t('photoGame.notStartedTitle') : t('photoGame.endedTitle')}
          </ThemedText>
        </View>
      );
    }

    if (isSubmitted && assignment) {
      return (
        <View
          style={[
            styles.card,
            isSoft ? softCard : { backgroundColor: colors.card, borderColor: colors.border + '33' },
          ]}
        >
          <ThemedText style={[styles.cardTitle, { color: colors.cardText }]}>
            {t('photoGame.submittedTitle')}
          </ThemedText>
          <ThemedText style={[styles.cardBody, { color: colors.cardText }]}>
            {t('photoGame.submittedBody')}
          </ThemedText>
          {assignment.photo_url && (
            <Image
              source={{ uri: assignment.photo_url }}
              style={[styles.thumbnail, isSoft && { borderRadius: variant.radius.tile }]}
              contentFit="cover"
              cachePolicy="disk"
            />
          )}
          <ThemedText style={[styles.taskLabel, { color: colors.cardText + 'aa' }]}>
            {t('photoGame.yourTask')}
          </ThemedText>
          <ThemedText style={[styles.taskText, { color: colors.cardText }]}>
            {assignment.task.description}
          </ThemedText>
          {error && (
            <ErrorBanner
              message={error}
              onRetry={loadStatus}
              style={{ marginBottom: theme.spacing.md, width: '100%' }}
            />
          )}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={[
              styles.button,
              {
                backgroundColor: colors.cardButton,
                opacity: uploading ? 0.6 : 1,
                borderRadius: isSoft ? variant.radius.button : theme.borderRadius.md,
              },
            ]}
          >
            {isSoft && <GradientFill color={colors.cardButton} radius={999} />}
            <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
              {uploading ? uploadingLabel() : t('photoGame.replaceButton')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (assignment) {
      return (
        <View
          style={[
            styles.card,
            isSoft ? softCard : { backgroundColor: colors.card, borderColor: colors.border + '33' },
          ]}
        >
          <ThemedText style={[styles.taskLabel, { color: colors.cardText + 'aa' }]}>
            {t('photoGame.yourTask')}
          </ThemedText>
          <ThemedText style={[styles.taskText, { color: colors.cardText }]}>
            {assignment.task.description}
          </ThemedText>
          {error && (
            <ErrorBanner
              message={error}
              onRetry={loadStatus}
              style={{ marginBottom: theme.spacing.md, width: '100%' }}
            />
          )}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={[
              styles.button,
              {
                backgroundColor: colors.cardButton,
                opacity: uploading ? 0.6 : 1,
                borderRadius: isSoft ? variant.radius.button : theme.borderRadius.md,
              },
            ]}
          >
            {isSoft && <GradientFill color={colors.cardButton} radius={999} />}
            {uploading ? (
              <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
                {uploadingLabel()}
              </ThemedText>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="camera-outline" size={18} color={colors.cardButtonText} />
                <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
                  {t('photoGame.uploadButton')}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Default: no assignment yet → invite the guest to request one.
    return (
      <View
        style={[
          styles.card,
          isSoft ? softCard : { backgroundColor: colors.card, borderColor: colors.border + '33' },
        ]}
      >
        <Ionicons
          name="camera-outline"
          size={32}
          color={colors.cardText}
          style={{ marginBottom: theme.spacing.sm }}
        />
        <ThemedText style={[styles.cardTitle, { color: colors.cardText }]}>
          {t('photoGame.disclaimerTitle')}
        </ThemedText>
        <ThemedText style={[styles.cardBody, { color: colors.cardText }]}>
          {t('photoGame.disclaimerBody')}
        </ThemedText>
        {error && (
          <ErrorBanner
            message={error}
            onRetry={loadStatus}
            style={{ marginBottom: theme.spacing.md, width: '100%' }}
          />
        )}
        <TouchableOpacity
          onPress={handleAssign}
          disabled={assigning}
          style={[
            styles.button,
            {
              backgroundColor: colors.cardButton,
              opacity: assigning ? 0.6 : 1,
              borderRadius: isSoft ? variant.radius.button : theme.borderRadius.md,
            },
          ]}
        >
          {isSoft && <GradientFill color={colors.cardButton} radius={999} />}
          <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
            {assigning ? t('photoGame.assigning') : t('photoGame.getTaskButton')}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg }]}>
      {isSoft && <ScreenGradient screenBg={colors.screenBg} primary={colors.primary} />}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tabTint}
            colors={[colors.tabTint]}
          />
        }
      >
        <FadeInView enabled={isSoft}>{renderContent()}</FadeInView>
      </ScrollView>
      <RefreshToast visible={refreshed} refreshing={refreshing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  cardBody: {
    fontSize: 14,
    opacity: 0.75,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  taskLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  taskText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    minWidth: 180,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  thumbnail: {
    width: 200,
    height: 200,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.md,
  },
});
