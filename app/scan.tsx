/**
 * Live QR-scanner screen — the primary login path.
 *
 * Flow:
 *   1. Ask for camera permission on mount (no early-return: the permission
 *      dialog is a normal iOS/Android alert, not a route).
 *   2. `CameraView` streams the back camera, `onBarcodeScanned` fires exactly
 *      once per unique QR (guarded by the `scanned` flag).
 *   3. Extract the trailing token from the URL, call `/api/auth/qr/{token}`.
 *   4. Solo → save session, route to `/`. Family → open picker with the
 *      returned guest list; the guest taps their name to trigger step 5.
 *   5. `/api/auth/qr/{token}/select` returns a per-guest bearer token; 409
 *      means someone already claimed this slot (grey out the row).
 *
 * The DEV token input at the bottom is guarded by `__DEV__` and lets the
 * developer paste a test token without needing a QR image. See CLAUDE.md
 * for the local test tokens.
 */
import { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import api from '../lib/api';
import { saveSession, GuestSession } from '../lib/auth';
import { theme } from '../constants/theme';
import { useLanguage, Language } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';

// --- Types (kept local to this file since only scan + welcome consume them) ---

type ApiGuest = {
  guest_id: number;
  firstname: string;
  lastname: string;
  token: string | null;
  is_active: boolean;
};

type ApiResponse = {
  type: 'solo' | 'family';
  family_name: string | null;
  guests: ApiGuest[];
};

export default function ScanScreen() {
  const router = useRouter();
  const { t, language, setLanguage, needsLanguagePick } = useLanguage();
  const { loadTheme } = useEventTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState<ApiGuest[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<'solo' | 'family'>('solo');
  const [showPicker, setShowPicker] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [devToken, setDevToken] = useState('');
  const [showDevInput, setShowDevInput] = useState(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    // Bootstrap permission ask — `requestPermission` shows the OS dialog
    // once. Re-firing on subsequent renders (which happens if we list
    // `permission?.granted` as a dep) would loop the request state
    // machine when the guest denies and the render pipeline updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Barcode-scanned handler — guarded by `scanned` so the same QR only fires
   * once, even though `CameraView` emits multiple detections per second.
   * The `scanned` flag is reset on error so the guest can retry.
   */
  async function handleQrCode(data: string) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    try {
      const token = data.split('/').filter(Boolean).pop();
      if (!token) throw new Error(t('scan.invalidQr'));
      await loginWithToken(token);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidQrMessage'));
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Step 1 of the two-step QR flow. Solo tokens hand back a ready-to-use
   * `guest.token`; family tokens hand back a list of guests with
   * `token: null` — the guest picks a name and step 2 mints a per-guest
   * token. Also opens the picker when `needsLanguagePick` is true so the
   * language switcher appears next to the "Continue" button.
   */
  async function loginWithToken(token: string) {
    const response = await api.get<ApiResponse>(`/api/auth/qr/${token}`);
    const { type, family_name, guests: apiGuests } = response.data;
    setResponseType(type);
    setFamilyName(family_name);
    setGuests(apiGuests);
    setQrToken(token);
    if (type === 'solo' && !needsLanguagePick) {
      await persistAndNavigate(apiGuests[0], type, family_name);
    } else {
      setShowPicker(true);
    }
  }

  async function persistAndNavigate(
    guest: ApiGuest,
    type: 'solo' | 'family',
    famName: string | null,
  ) {
    if (!guest.token) return;
    const session: GuestSession = {
      token: guest.token,
      guestId: guest.guest_id,
      firstname: guest.firstname,
      lastname: guest.lastname,
      type,
      familyName: famName,
    };
    await saveSession(session);
    await loadTheme();
    setShowPicker(false);
    router.replace('/');
  }

  /**
   * Step 2 of the family QR flow — trade the shared QR token for a per-guest
   * bearer token. 409 means the slot was already claimed on another device;
   * we mark it locally as `is_active: true` so the row is greyed out
   * without a re-fetch.
   */
  async function selectFamilyGuest(guest: ApiGuest) {
    if (guest.is_active) return;
    setLoading(true);
    try {
      type SelectResponse = { guest_id: number; firstname: string; lastname: string; token: string };
      const res = await api.post<SelectResponse>(`/api/auth/qr/${qrToken}/select`, { guest_id: guest.guest_id });
      const { token, firstname, lastname } = res.data;
      const session: GuestSession = {
        token,
        guestId: guest.guest_id,
        firstname,
        lastname,
        type: responseType,
        familyName,
      };
      await saveSession(session);
      await loadTheme();
      setShowPicker(false);
      router.replace('/');
    } catch (e: any) {
      if (e?.response?.status === 409) {
        Alert.alert(t('common.error'), t('scan.alreadyLoggedIn'));
        setGuests((prev) => prev.map((g) => g.guest_id === guest.guest_id ? { ...g, is_active: true } : g));
      } else {
        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidQrMessage'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.permissionText}>
          {t('scan.cameraPermissionText')}
        </ThemedText>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <ThemedText style={styles.buttonText}>{t('scan.allowAccess')}</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => handleQrCode(data)}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      )}

      {/* DEV-only: manual token input — see CLAUDE.md for local test tokens. */}
      {__DEV__ && (
        <View style={styles.devContainer}>
          {showDevInput ? (
            <View style={styles.devInputBox}>
              <ThemedText style={styles.devLabel}>{t('scan.devLabel')}</ThemedText>
              <TextInput
                style={styles.devInput}
                placeholder={t('scan.devPlaceholder')}
                value={devToken}
                onChangeText={setDevToken}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.devButton}
                onPress={async () => {
                  setShowDevInput(false);
                  setLoading(true);
                  try {
                    await loginWithToken(devToken.trim());
                  } catch (e: any) {
                    Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidTokenMessage'));
                    setScanned(false);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <ThemedText style={styles.devButtonText}>{t('scan.devLogin')}</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.devToggle}
              onPress={() => setShowDevInput(true)}
            >
              <ThemedText style={styles.devToggleText}>{t('scan.devToggle')}</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Family picker — also carries the language switcher when detection fails. */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {guests.length > 1 && (
              <>
                <ThemedText style={styles.modalTitle}>
                  {familyName ? t('scan.familyTitle', { name: familyName }) : t('scan.whoAreYou')}
                </ThemedText>
                <ThemedText style={styles.modalSubtitle}>{t('scan.chooseName')}</ThemedText>
                <FlatList
                  data={guests}
                  keyExtractor={(item) => String(item.guest_id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.guestRow, item.is_active && styles.guestRowDisabled]}
                      onPress={() => selectFamilyGuest(item)}
                      activeOpacity={item.is_active ? 1 : 0.7}
                    >
                      <ThemedText style={[styles.guestName, item.is_active && styles.guestNameDisabled]}>
                        {item.firstname} {item.lastname}
                      </ThemedText>
                      {item.is_active && (
                        <ThemedText style={styles.guestActiveHint}>{t('scan.alreadyLoggedIn')}</ThemedText>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            {guests.length === 1 && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => persistAndNavigate(guests[0], responseType, familyName)}
              >
                <ThemedText style={styles.continueButtonText}>{t('scan.continue')}</ThemedText>
              </TouchableOpacity>
            )}

            {/* Language picker — only appears when device locale is neither DE nor EN. */}
            {needsLanguagePick && (
              <View style={styles.langRow}>
                {(['de', 'en'] as Language[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langButton, language === lang && styles.langButtonActive]}
                    onPress={() => setLanguage(lang)}
                  >
                    <ThemedText style={[styles.langButtonText, language === lang && styles.langButtonTextActive]}>
                      {lang === 'de' ? '🇩🇪  Deutsch' : '🇬🇧  English'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  permissionText: {
    color: theme.colors.primary,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: theme.spacing.lg,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  buttonText: {
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
  },
  devInputBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  devLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
  },
  devInput: {
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  devButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  devButtonText: {
    color: theme.colors.secondary,
    fontSize: 14,
  },
  devToggle: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  devToggleText: {
    color: theme.colors.secondary,
    fontSize: 12,
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
  continueButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  continueButtonText: {
    color: theme.colors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  langButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  langButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  langButtonText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  langButtonTextActive: {
    color: theme.colors.secondary,
  },
  guestRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  guestRowDisabled: {
    opacity: 0.4,
  },
  guestName: {
    fontSize: 16,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  guestNameDisabled: {
    color: theme.colors.muted,
  },
  guestActiveHint: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
});
