jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../lib/api';
import {
  deleteManagementPhoto,
  deleteManagementPhotos,
  fetchManagementPhotos,
  uploadManagementPhoto,
} from '../../lib/managementPhotos';

const mockedApi = api as jest.Mocked<typeof api>;

describe('management photos API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads all galleries for the active event', async () => {
    const albums = [{ id: 2, slug: 'presentation', name: 'Presentation', photos: [] }];
    mockedApi.get.mockResolvedValue({ data: { albums } });

    await expect(fetchManagementPhotos()).resolves.toEqual(albums);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/management/photos', { signal: undefined });
  });

  it('supports single and batch deletion through management routes', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });

    await deleteManagementPhoto(9);
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/management/photos/9');

    await deleteManagementPhotos([9, 10]);
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/management/photos', {
      data: { ids: [9, 10] },
    });
  });

  it('uploads a prepared image into the selected management album', async () => {
    mockedApi.post.mockResolvedValue({ data: { id: 12 } });
    const append = jest.spyOn(FormData.prototype, 'append');

    await uploadManagementPhoto(7, 'file:///tmp/photo.jpg');

    expect(append).toHaveBeenCalledWith('album_id', '7');
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/api/management/photos',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: expect.any(Function),
      })
    );
    const [, formData, rawOptions] = mockedApi.post.mock.calls[0];
    const options = rawOptions as any;
    expect(options.transformRequest(formData)).toBe(formData);
    const progress = jest.fn();
    await uploadManagementPhoto(7, 'file:///tmp/photo.jpg', progress);
    const secondOptions = mockedApi.post.mock.calls[1][2] as any;
    secondOptions.onUploadProgress({ loaded: 5, total: 10 } as any);
    secondOptions.onUploadProgress({ loaded: 5 } as any);
    expect(progress).toHaveBeenNthCalledWith(1, 0.5);
    expect(progress).toHaveBeenNthCalledWith(2, null);
    options.onUploadProgress({ loaded: 1, total: 1 } as any);
    append.mockRestore();
  });
});
