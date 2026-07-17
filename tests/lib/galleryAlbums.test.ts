import {
  buildGuestGalleryAlbums,
  guestVisibleAlbums,
  isManagementUploadableAlbum,
} from '../../lib/galleryAlbums';

describe('gallery album capabilities', () => {
  it('keeps the guest UI on app_gallery while preserving a multi-album data shape', () => {
    expect(
      guestVisibleAlbums([
        { slug: 'app_gallery', name: 'App' },
        { slug: 'photo_game', name: 'Game' },
        { slug: 'presentation', name: 'Presentation' },
      ])
    ).toEqual([{ slug: 'app_gallery', name: 'App' }]);
    expect(buildGuestGalleryAlbums([{ id: 1 }])).toEqual([
      { slug: 'app_gallery', photos: [{ id: 1 }] },
    ]);
  });

  it('allows generic management uploads only for app and presentation galleries', () => {
    expect(isManagementUploadableAlbum('app_gallery')).toBe(true);
    expect(isManagementUploadableAlbum('presentation')).toBe(true);
    expect(isManagementUploadableAlbum('photo_game')).toBe(false);
  });
});
