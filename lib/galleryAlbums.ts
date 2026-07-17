export const GUEST_VISIBLE_ALBUM_SLUGS = ['app_gallery'] as const;
export const MANAGEMENT_UPLOADABLE_ALBUM_SLUGS = ['app_gallery', 'presentation'] as const;

export type GalleryAlbumSlug = 'app_gallery' | 'presentation' | 'photo_game' | string;

export function isManagementUploadableAlbum(slug: GalleryAlbumSlug): boolean {
  return (MANAGEMENT_UPLOADABLE_ALBUM_SLUGS as readonly string[]).includes(slug);
}

export function guestVisibleAlbums<T extends { slug: string }>(albums: T[]): T[] {
  return albums.filter((album) =>
    (GUEST_VISIBLE_ALBUM_SLUGS as readonly string[]).includes(album.slug)
  );
}

export function buildGuestGalleryAlbums<T>(appGalleryPhotos: T[]) {
  return guestVisibleAlbums([{ slug: 'app_gallery', photos: appGalleryPhotos }]);
}
