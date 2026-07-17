jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../lib/api';
import {
  deleteManagementPhoto,
  deleteManagementPhotos,
  fetchManagementPhotos,
} from '../../lib/managementPhotos';

const mockedApi = api as jest.Mocked<typeof api>;

describe('management photos API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads all galleries for the active event', async () => {
    const albums = [{ id: 2, slug: 'presentation', name: 'Presentation', photos: [] }];
    mockedApi.get.mockResolvedValue({ data: { albums } });

    await expect(fetchManagementPhotos()).resolves.toEqual(albums);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/management/photos');
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
});
