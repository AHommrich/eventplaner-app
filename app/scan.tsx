import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../lib/api';
import { saveSession, GuestSession } from '../lib/auth';
import { theme } from '../constants/theme';
import { useLanguage, Language } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';

type ApiGuest = {
  guest_id: number;
  firstname: string;
  lastname: string;
  token: string;
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
  const [devToken, setDevToken] = useState('');
  const [showDevInput, setShowDevInput] = useState(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  async function handleQrCode(data: string) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    try {
      const token = data.split('/').pop();
      if (!token) throw new Error(t('scan.invalidQr'));
      await loginWithToken(token);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidQrMessage'));
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('common.accessDenied'), t('photos.libraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    setLoading(true);
    try {
      const scans = await BarCodeScanner.scanFromURLAsync(result.assets[0].uri, ['qr']);
      if (!scans.length) {
        Alert.alert(t('common.error'), t('scan.noQrInImage'));
        return;
      }
      await handleQrCode(scans[0].data);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('scan.invalidQrMessage'));
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithToken(token: string) {
    const response = await api.get<ApiResponse>(`/api/auth/qr/${token}`);
    const { type, family_name, guests: apiGuests } = response.data;
    setResponseType(type);
    setFamilyName(family_name);
    setGuests(apiGuests);
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

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          {t('scan.cameraPermissionText')}
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('scan.allowAccess')}</Text>
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

      {/* Galerie-Button — QR aus Bild lesen */}
      {!loading && (
        <TouchableOpacity style={styles.galleryButton} onPress={handlePickImage}>
          <Ionicons name="image-outline" size={28} color="#fff" />
          <Text style={styles.galleryButtonText}>{t('scan.fromGallery')}</Text>
        </TouchableOpacity>
      )}

      {/* Dev-Modus: manuelle Token-Eingabe */}
      {__DEV__ && (
        <View style={styles.devContainer}>
          {showDevInput ? (
            <View style={styles.devInputBox}>
              <Text style={styles.devLabel}>{t('scan.devLabel')}</Text>
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
                <Text style={styles.devButtonText}>{t('scan.devLogin')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.devToggle}
              onPress={() => setShowDevInput(true)}
            >
              <Text style={styles.devToggleText}>{t('scan.devToggle')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Gastauswahl für Familien */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {guests.length > 1 && (
              <>
                <Text style={styles.modalTitle}>
                  {familyName ? t('scan.familyTitle', { name: familyName }) : t('scan.whoAreYou')}
                </Text>
                <Text style={styles.modalSubtitle}>{t('scan.chooseName')}</Text>
                <FlatList
                  data={guests}
                  keyExtractor={(item) => String(item.guest_id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.guestRow}
                      onPress={() => persistAndNavigate(item, responseType, familyName)}
                    >
                      <Text style={styles.guestName}>
                        {item.firstname} {item.lastname}
                      </Text>
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
                <Text style={styles.continueButtonText}>{t('scan.continue')}</Text>
              </TouchableOpacity>
            )}

            {/* Sprachauswahl — nur wenn Sprache nicht automatisch erkannt */}
            {needsLanguagePick && (
              <View style={styles.langRow}>
                {(['de', 'en'] as Language[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langButton, language === lang && styles.langButtonActive]}
                    onPress={() => setLanguage(lang)}
                  >
                    <Text style={[styles.langButtonText, language === lang && styles.langButtonTextActive]}>
                      {lang === 'de' ? '🇩🇪  Deutsch' : '🇬🇧  English'}
                    </Text>
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
  galleryButton: {
    position: 'absolute',
    bottom: 48,
    left: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  galleryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  },
  guestName: {
    fontSize: 16,
    color: theme.colors.primary,
    textAlign: 'center',
  },
});
