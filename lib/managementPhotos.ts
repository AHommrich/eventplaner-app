import api from './api';

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

export async function fetchManagementPhotos(): Promise<ManagementPhotoAlbum[]> {
  const response = await api.get<{ albums: ManagementPhotoAlbum[] }>('/api/management/photos');
  return response.data.albums;
}

export async function deleteManagementPhoto(photoId: number): Promise<void> {
  await api.delete(`/api/management/photos/${photoId}`);
}

export async function deleteManagementPhotos(photoIds: number[]): Promise<void> {
  await api.delete('/api/management/photos', { data: { ids: photoIds } });
}
