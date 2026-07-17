import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PhotoPickResult = { uri: string } | { permissionDenied: true } | null;

export async function pickPhotoFromLibrary(): Promise<PhotoPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { permissionDenied: true };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  return result.canceled ? null : { uri: result.assets[0].uri };
}

export async function takePhotoWithCamera(): Promise<PhotoPickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { permissionDenied: true };
  const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
  return result.canceled ? null : { uri: result.assets[0].uri };
}

export async function preparePhotoJpeg(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
