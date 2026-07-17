import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { pickPhotoFromLibrary, preparePhotoJpeg, takePhotoWithCamera } from '../../lib/photoPicker';

describe('shared photo picker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns selected camera and library assets', async () => {
    await expect(pickPhotoFromLibrary()).resolves.toEqual({
      uri: 'file:///tmp/fixture-library.jpg',
    });
    await expect(takePhotoWithCamera()).resolves.toEqual({
      uri: 'file:///tmp/fixture-camera.jpg',
    });
  });

  it('distinguishes permission denial and cancellation', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });
    await expect(pickPhotoFromLibrary()).resolves.toEqual({ permissionDenied: true });

    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });
    await expect(pickPhotoFromLibrary()).resolves.toBeNull();

    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });
    await expect(takePhotoWithCamera()).resolves.toEqual({ permissionDenied: true });

    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });
    await expect(takePhotoWithCamera()).resolves.toBeNull();
  });

  it('re-encodes uploads as compressed JPEG', async () => {
    await expect(preparePhotoJpeg('file:///tmp/photo.heic')).resolves.toBe(
      'file:///tmp/photo.heic'
    );
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///tmp/photo.heic',
      [],
      expect.objectContaining({ compress: 0.8, format: 'jpeg' })
    );
  });
});
