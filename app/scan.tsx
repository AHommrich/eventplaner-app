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
    if (!permission?.granted) {
      requestPermission();
    }
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
    router.replace('/home');
  }

  // Dev-Modus: manuelle Token-Eingabe
  const devInput = __DEV__ && (
    <View className="absolute bottom-8 left-0 right-0 px-6">
      {showDevInput ? (
        <View className="bg-white rounded-lg p-4 shadow">
          <Text className="text-xs text-muted mb-2">Dev: Token eingeben</Text>
          <TextInput
            className="border border-muted rounded px-3 py-2 text-primary mb-3"
            placeholder="QR-Token..."
            value={devToken}
            onChangeText={setDevToken}
            autoCapitalize="none"
          />
          <TouchableOpacity
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
            className="bg-primary rounded py-2 items-center"
          >
            <Text className="text-white text-sm">Einloggen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setShowDevInput(true)}
          className="bg-black/50 rounded py-2 items-center"
        >
          <Text className="text-white text-xs">DEV: Token manuell eingeben</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (!permission) return <View className="flex-1 bg-background" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-primary text-center text-base mb-6">
          Kamera-Zugriff benötigt um den QR-Code zu scannen.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary px-8 py-4 rounded-lg"
        >
          <Text className="text-secondary font-semibold">Zugriff erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <CameraView
        className="flex-1"
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => handleQrCode(data)}
      />

      {loading && (
        <View className="absolute inset-0 bg-black/60 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.secondary} />
        </View>
      )}

      {devInput}

      {/* Gastauswahl für Familien */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-surface rounded-t-2xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold text-primary text-center mb-2">
              {familyName ? `Familie ${familyName}` : 'Wer bist du?'}
            </Text>
            <Text className="text-sm text-muted text-center mb-6">
              Bitte wähle deinen Namen aus.
            </Text>
            <FlatList
              data={guests}
              keyExtractor={(item) => String(item.guest_id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => persistAndNavigate(item, responseType, familyName)}
                  className="py-4 border-b border-gray-100"
                >
                  <Text className="text-base text-primary text-center">
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
