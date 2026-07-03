/**
 * Welcome / entry screen.
 *
 * Two responsibilities:
 *
 *   1. **Session probe on mount.** If SecureStore holds a session, fetch the
 *      guest and redirect based on `rsvp_status`:
 *        - `null` .................. never answered → `/rsvp` onboarding
 *        - `accepted_pending` /
 *          `accepted` ............. → `/(tabs)/home`
 *        - `declined_pending` /
 *          `declined` /
 *          `revocation_requested` .. → `/declined`
 *      On error (network offline, backend down) we keep the welcome screen
 *      visible so the guest can retry via the scan button.
 *
 *   2. **Gallery QR fallback login.** Guests can either scan the QR live
 *      (`/scan`) or pick a photo of the invitation from their gallery. The
 *      gallery path uses `QrFromImageView` (WebView + jsQR) to decode
 *      offline. Both paths feed the same two-step auth flow described in
 *      `lib/guest.ts` — solo tokens log in immediately, family tokens open
 *      the family picker modal.
 */
import { useEffect, useState } from 'react';
import { View, Image, Text, TouchableOpacity, Alert, StyleSheet, Modal, FlatList } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { getSession, saveSession, GuestSession } from '../lib/auth';
import { fetchGuestMe, isFullAccess, isDeclinedFlow, RsvpStatus } from '../lib/guest';
import { useLanguage } from '../lib/LanguageContext';
import { QrFromImageView } from '../lib/QrFromImage';
import api from '../lib/api';
import { useEventTheme } from '../lib/EventThemeContext';
import { theme } from '../constants/theme';

// Same splash palette as `_layout.tsx` — visual continuity when the splash
// fades out into this screen.
const SPLASH_COLORS = ['#FF6B8A', '#FF8C5A', '#FFD166', '#72D4C8'] as const;

type ApiGuest = { guest_id: number; firstname: string; lastname: string; token: string | null; is_active: boolean };
type ApiResponse = { type: 'solo' | 'family'; family_name: string | null; guests: ApiGuest[] };

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { loadTheme } = useEventTheme();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [qrDecoder, setQrDecoder] = useState<((uri: string) => Promise<string | null>) | null>(null);
  const [familyGuests, setFamilyGuests] = useState<ApiGuest[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<'solo' | 'family'>('solo');
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session) {
        setChecking(false);
        return;
      }
      try {
        const guest = await fetchGuestMe();
        if (guest.rsvp_status === null) {
          router.replace('/rsvp');
        } else if (isFullAccess(guest.rsvp_status)) {
          router.replace('/(tabs)/home');
        } else if (isDeclinedFlow(guest.rsvp_status)) {
          router.replace('/declined');
        }
      } catch {
        // Backend unreachable — keep the welcome screen so guest can retry.
        setChecking(false);
      }
    });
  }, []);

  /**
   * Gallery-fallback login flow:
   *   1. Ask for media-library permission.
   *   2. Let the guest pick an image.
   *   3. Base64-encode via `expo-file-system` so `QrFromImageView` can load
   *      it inside the WebView (a `file://` URI would be blocked by CORS).
   *   4. Decode → parse → hit `/api/auth/qr/{token}` → same solo/family branch
   *      as the live scanner.
   */
  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.accessDenied'), t('photos.libraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;
    if (!qrDecoder) {
      Alert.alert(t('common.error'), t('scan.decoderNotReady'));
      return;
    }
    setLoading(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64}`;
      const data = await qrDecoder(dataUri);
      if (!data) {
        Alert.alert(t('common.error'), t('scan.noQrInImage'));
        return;
      }
      const token = data.split('/').filter(Boolean).pop();
      if (!token) throw new Error(t('scan.invalidQr'));
      const response = await api.get<ApiResponse>(`/api/auth/qr/${token}`);
      const { type, family_name, guests } = response.data;
      if (type === 'solo' && guests[0]?.token) {
        const g = guests[0];
        const session: GuestSession = {
          token: g.token!, guestId: g.guest_id, firstname: g.firstname,
          lastname: g.lastname, type, familyName: family_name,
        };
        await saveSession(session);
        await loadTheme();
        const me = await fetchGuestMe();
        navigateByStatus(me.rsvp_status);
      } else {
        setQrToken(token);
        setFamilyGuests(guests);
        setFamilyName(family_name);
        setResponseType(type);
        setShowFamilyPicker(true);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidQrMessage'));
    } finally {
      setLoading(false);
    }
  }

  /** Post-login redirect — the same matrix as the session probe above. */
  async function navigateByStatus(status: RsvpStatus | null) {
    if (status === null) {
      router.replace('/rsvp');
    } else if (isFullAccess(status)) {
      router.replace('/(tabs)/home');
    } else if (isDeclinedFlow(status)) {
      router.replace('/declined');
    } else {
      router.replace('/rsvp');
    }
  }

  /**
   * Second step of a family QR flow: guest picks their name, we hit
   * `/api/auth/qr/{token}/select` to trade the QR token for a per-guest
   * bearer token. 409 = another device already claimed this slot — grey the
   * row out via `is_active: true` and keep the picker open.
   */
  async function selectFamilyGuest(guest: ApiGuest) {
    if (guest.is_active || !qrToken) return;
    setLoading(true);
    try {
      type SelectResponse = { guest_id: number; firstname: string; lastname: string; token: string };
      const res = await api.post<SelectResponse>(`/api/auth/qr/${qrToken}/select`, { guest_id: guest.guest_id });
      const { token, firstname, lastname } = res.data;
      const session: GuestSession = {
        token, guestId: guest.guest_id, firstname, lastname,
        type: responseType, familyName,
      };
      await saveSession(session);
      await loadTheme();
      setShowFamilyPicker(false);
      const me = await fetchGuestMe();
      navigateByStatus(me.rsvp_status);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        Alert.alert(t('common.error'), t('scan.alreadyLoggedIn'));
        setFamilyGuests((prev) => prev.map((g) => g.guest_id === guest.guest_id ? { ...g, is_active: true } : g));
      } else {
        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidQrMessage'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={SPLASH_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bg}
    >
      <View style={styles.logoWrap}>
        <Image
          source={require('../assets/eve-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoTagline}>eveplan</Text>
      </View>

      <View style={styles.content}>
        {!checking && (
          <>
            <ThemedText style={styles.title}>{t('welcome.title')}</ThemedText>
            <ThemedText style={styles.subtitle}>{t('welcome.subtitle')}</ThemedText>

            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => router.push('/scan')}
              disabled={loading}
            >
              <ThemedText style={styles.scanButtonText}>{t('welcome.scanButton')}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handlePickImage}
              disabled={loading}
            >
              <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.9)" />
              <ThemedText style={styles.galleryButtonText}>{t('scan.fromGallery')}</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Hidden WebView decoder — mounts once and hands us back a `decode` fn. */}
      <QrFromImageView onReady={(fn) => setQrDecoder(() => fn)} />

      <Modal visible={showFamilyPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ThemedText style={styles.modalTitle}>
              {familyName ? t('scan.familyTitle', { name: familyName }) : t('scan.whoAreYou')}
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>{t('scan.chooseName')}</ThemedText>
            <FlatList
              data={familyGuests}
              keyExtractor={(item) => String(item.guest_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.guestRow, item.is_active && { opacity: 0.4 }]}
                  onPress={() => selectFamilyGuest(item)}
                  activeOpacity={item.is_active ? 1 : 0.7}
                >
                  <ThemedText style={[styles.guestName, item.is_active && { color: theme.colors.muted }]}>
                    {item.firstname} {item.lastname}
                  </ThemedText>
                  {item.is_active && (
                    <ThemedText style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2, textAlign: 'center' }}>
                      {t('scan.alreadyLoggedIn')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  logoWrap: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logoImage: {
    width: 420,
    height: 200,
  },
  logoTagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: -60,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 64,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    marginBottom: 40,
  },
  scanButton: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    width: '100%',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '600',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
  },
  galleryButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 19,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  guestRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  guestName: {
    fontSize: 16,
    color: theme.colors.primary,
    textAlign: 'center',
  },
});
