import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { getActiveManagementEventId } from '../../lib/management';
import {
  deleteManagementPhoto,
  fetchManagementPhotos,
  ManagementPhoto,
  ManagementPhotoAlbum,
} from '../../lib/managementPhotos';

export default function OrganizerPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [albums, setAlbums] = useState<ManagementPhotoAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!(await getActiveManagementEventId())) {
      router.replace('/organizer');
      return;
    }

    try {
      const available = await fetchManagementPhotos();
      setAlbums([...available].sort((a, b) => a.sort_order - b.sort_order));
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
          } catch {
            Alert.alert(t('common.error'), t('organizer.photos.deleteFailed'));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
      ]}
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
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel={t('a11y.back')} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>{t('organizer.photos.title')}</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ThemedText style={styles.subtitle}>{t('organizer.photos.subtitle')}</ThemedText>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : failed ? (
        <TouchableOpacity style={styles.card} onPress={() => void load()}>
          <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
          <ThemedText style={styles.retry}>{t('common.retry')}</ThemedText>
        </TouchableOpacity>
      ) : albums.length === 0 ? (
        <View style={styles.card}>
          <ThemedText style={styles.empty}>{t('organizer.photos.noAlbums')}</ThemedText>
        </View>
      ) : (
        albums.map((album) => (
          <View key={album.id} style={styles.card}>
            <View style={styles.albumHeader}>
              <ThemedText style={styles.cardTitle}>{album.name}</ThemedText>
              <ThemedText style={styles.count}>{album.photos.length}</ThemedText>
            </View>
            {album.photos.length === 0 ? (
              <ThemedText style={styles.empty}>{t('organizer.photos.emptyAlbum')}</ThemedText>
            ) : (
              <View style={styles.grid}>
                {album.photos.map((photo) => (
                  <View key={photo.id} style={styles.photoCard}>
                    <Image
                      accessibilityLabel={photo.description ?? t('organizer.photos.photo')}
                      source={photo.url}
                      style={styles.image}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                    <View style={styles.photoInfo}>
                      <ThemedText numberOfLines={1} style={styles.uploader}>
                        {photo.guest_name ?? photo.uploaded_by ?? t('organizer.photos.unknown')}
                      </ThemedText>
                      {!!(photo.task_description ?? photo.description) && (
                        <ThemedText numberOfLines={2} style={styles.description}>
                          {photo.task_description ?? photo.description}
                        </ThemedText>
                      )}
                    </View>
                    <TouchableOpacity
                      accessibilityLabel={t('organizer.photos.deletePhoto')}
                      style={styles.deleteButton}
                      onPress={() => remove(photo)}
                      disabled={deletingId === photo.id}
                    >
                      {deletingId === photo.id ? (
                        <ActivityIndicator size="small" color={theme.colors.secondary} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={theme.colors.secondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: { width: 26 },
  title: { color: theme.colors.primary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: theme.colors.muted, textAlign: 'center', marginBottom: theme.spacing.xs },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  cardTitle: { color: theme.colors.primary, fontSize: 17, fontWeight: '700' },
  count: {
    minWidth: 28,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    color: theme.colors.secondary,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  photoCard: {
    width: '48.5%',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 1 },
  photoInfo: { padding: theme.spacing.sm, minHeight: 54 },
  uploader: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  description: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  deleteButton: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  retry: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    marginTop: theme.spacing.xs,
  },
});
