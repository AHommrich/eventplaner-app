import api from './api';
import { preparePhotoJpeg } from './photoPicker';

export type ManagementPhoto = {
  id: number;
  url: string;
  guest_name: string | null;
  uploaded_by: string | null;
  uploader_role: string | null;
  description: string | null;
  task_description: string | null;
  created_at: string;
};

export type ManagementPhotoAlbum = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  photos: ManagementPhoto[];
};

export async function fetchManagementPhotos(signal?: AbortSignal): Promise<ManagementPhotoAlbum[]> {
  const response = await api.get<{ albums: ManagementPhotoAlbum[] }>('/api/management/photos', {
    signal,
  });
  return response.data.albums;
}

export async function uploadManagementPhoto(
  albumId: number,
  uri: string,
  onProgress?: (progress: number | null) => void
): Promise<void> {
  const jpegUri = await preparePhotoJpeg(uri);
  const formData = new FormData();
  formData.append('photo', {
    uri: jpegUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);
  formData.append('album_id', String(albumId));

  await api.post('/api/management/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
    onUploadProgress: (event) => onProgress?.(event.total ? event.loaded / event.total : null),
  });
}

export async function deleteManagementPhoto(photoId: number): Promise<void> {
  await api.delete(`/api/management/photos/${photoId}`);
}

export async function deleteManagementPhotos(photoIds: number[]): Promise<void> {
  await api.delete('/api/management/photos', { data: { ids: photoIds } });
}
