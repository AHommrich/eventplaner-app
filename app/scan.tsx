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
import { useRouter } from 'expo-router';
import api from '../lib/api';
import { saveSession, GuestSession } from '../lib/auth';
import { theme } from '../constants/theme';

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
      if (!token) throw new Error('Ungültiger QR-Code');
      await loginWithToken(token);
    } catch (e: any) {
      Alert.alert('Fehler', e?.response?.data?.message ?? 'Ungültiger QR-Code.');
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
    if (type === 'solo' && apiGuests.length === 1) {
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
    setShowPicker(false);
    router.replace('/(tabs)/home');
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Kamera-Zugriff benötigt um den QR-Code zu scannen.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Zugriff erlauben</Text>
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

      {/* Dev-Modus: manuelle Token-Eingabe */}
      {__DEV__ && (
        <View style={styles.devContainer}>
          {showDevInput ? (
            <View style={styles.devInputBox}>
              <Text style={styles.devLabel}>Dev: Token eingeben</Text>
              <TextInput
                style={styles.devInput}
                placeholder="QR-Token..."
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
                    Alert.alert('Fehler', e?.response?.data?.message ?? 'Ungültiger Token.');
                    setScanned(false);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.devButtonText}>Einloggen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.devToggle}
              onPress={() => setShowDevInput(true)}
            >
              <Text style={styles.devToggleText}>DEV: Token manuell eingeben</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Gastauswahl für Familien */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {familyName ? `Familie ${familyName}` : 'Wer bist du?'}
            </Text>
            <Text style={styles.modalSubtitle}>Bitte wähle deinen Namen aus.</Text>
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
