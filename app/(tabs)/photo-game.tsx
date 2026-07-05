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
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useFocusEffect } from 'expo-router';
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
import { theme } from '../../constants/theme';

export default function PhotoGameScreen() {
  const { t } = useLanguage();
  const { colors } = useEventTheme();
  const { ensureConsent } = useConsentGate();
  const insets = useSafeAreaInsets();
  const [statusData, setStatusData] = useState<PhotoGameStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the current photo-game state (enabled? assignment already claimed?
   * submitted?). Feeds the four-state UI in `<Content />`. Errors are shown
   * inline on the screen rather than in an alert — the screen has an error
   * card slot precisely for this, so a transient outage doesn't block the
   * whole tab.
   */
  async function loadStatus() {
    try {
      const data = await fetchPhotoGameStatus();
      setStatusData(data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('common.unknownError'));
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadStatus();
      // Same rationale as the other tab screens: the focus-effect callback
      // is captured once so `useFocusEffect` fires on route focus, not on
      // every render caused by an unrelated state change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const { refreshing, refreshed, onRefresh } = useRefreshToast(loadStatus);

  /**
   * Ask the backend for a fresh task. Optimistically synthesise the returned
   * assignment into `statusData` so the UI updates without a follow-up
   * fetch. 409 means the server already had one for us — re-sync via
   * `loadStatus` picks up the existing assignment.
   */
  async function handleAssign() {
    setAssigning(true);
    setError(null);
    try {
      const result = await assignPhotoGameTask();
      setStatusData((prev) =>
        prev
          ? {
              ...prev,
              assignment: { id: result.id, task: result.task, submitted_at: null, photo_url: null },
            }
          : prev
      );
    } catch (e: any) {
      if (e?.response?.status === 409) {
        await loadStatus();
      } else {
        setError(e?.response?.data?.message ?? e?.message ?? t('common.unknownError'));
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
    setError(null);
    try {
      const submitted = await submitPhotoGamePhoto(jpeg.uri);
      setStatusData((prev) =>
        prev && prev.assignment
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
    } catch (e: any) {
      if (e?.response?.status === 409) {
        await loadStatus();
      } else {
        setError(e?.response?.data?.message ?? e?.message ?? t('common.unknownError'));
      }
    } finally {
      setUploading(false);
    }
  }

  if (loading && !statusData) {
    return (
      <View style={[styles.center, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator color={colors.tabTint} />
      </View>
    );
  }

  const status = statusData?.status;
  const assignment = statusData?.assignment ?? null;
  const isSubmitted = !!assignment?.submitted_at;
  const isEnded = status === 'ended' || status === 'draft';

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
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border + '33' }]}
        >
          <Ionicons
            name="time-outline"
            size={32}
            color={colors.cardText}
            style={{ marginBottom: theme.spacing.sm }}
          />
          <ThemedText style={[styles.cardTitle, { color: colors.cardText }]}>
            {t('photoGame.endedTitle')}
          </ThemedText>
        </View>
      );
    }

    if (isSubmitted && assignment) {
      return (
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border + '33' }]}
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
              style={styles.thumbnail}
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
            <ThemedText style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </ThemedText>
          )}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={[
              styles.button,
              { backgroundColor: colors.cardButton, opacity: uploading ? 0.6 : 1 },
            ]}
          >
            <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
              {uploading ? t('photoGame.uploading') : t('photoGame.replaceButton')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (assignment) {
      return (
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border + '33' }]}
        >
          <ThemedText style={[styles.taskLabel, { color: colors.cardText + 'aa' }]}>
            {t('photoGame.yourTask')}
          </ThemedText>
          <ThemedText style={[styles.taskText, { color: colors.cardText }]}>
            {assignment.task.description}
          </ThemedText>
          {error && (
            <ThemedText style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </ThemedText>
          )}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={[
              styles.button,
              { backgroundColor: colors.cardButton, opacity: uploading ? 0.6 : 1 },
            ]}
          >
            {uploading ? (
              <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
                {t('photoGame.uploading')}
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
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border + '33' }]}
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
          <ThemedText style={[styles.errorText, { color: theme.colors.error }]}>{error}</ThemedText>
        )}
        <TouchableOpacity
          onPress={handleAssign}
          disabled={assigning}
          style={[
            styles.button,
            { backgroundColor: colors.cardButton, opacity: assigning ? 0.6 : 1 },
          ]}
        >
          <ThemedText style={[styles.buttonText, { color: colors.cardButtonText }]}>
            {assigning ? t('photoGame.assigning') : t('photoGame.getTaskButton')}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg }]}>
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
        {renderContent()}
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
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
});
