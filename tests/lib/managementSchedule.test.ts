import api from '../../lib/api';
import { fetchManagementSchedule } from '../../lib/managementSchedule';

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe('lib/managementSchedule', () => {
  it('uses the dedicated read-only management endpoint', async () => {
    const payload = {
      date: '2099-06-01',
      schedule: null,
      schedule_stations: [{ id: 1, title: 'Ceremony', starts_at: '14:00' }],
    };
    (api.get as jest.Mock).mockResolvedValue({ data: payload });

    await expect(fetchManagementSchedule()).resolves.toEqual(payload);
    expect(api.get).toHaveBeenCalledWith('/api/management/schedule', { signal: undefined });
  });
});
