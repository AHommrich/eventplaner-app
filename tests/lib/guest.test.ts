/**
 * `lib/guest` — typed wrappers around the guest-facing HTTP endpoints.
 *
 * We mock the shared axios instance in `lib/api` and assert both the URL /
 * shape each caller uses and the response propagation. The type guards
 * (`isFullAccess`, `isDeclinedFlow`) are exercised in isolation.
 */
import {
  fetchGuestMe,
  fetchEventInfo,
  postRsvp,
  postGroupRsvp,
  postRevoke,
  fetchPhotoGameStatus,
  assignPhotoGameTask,
  submitPhotoGamePhoto,
  isFullAccess,
  isDeclinedFlow,
} from '../../lib/guest';

jest.mock('../../lib/api', () => {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return { __esModule: true, default: mock };
});

const api = require('../../lib/api').default;

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.delete.mockReset();
});

describe('lib/guest — type guards', () => {
  it('isFullAccess is true only for accepted_pending and accepted', () => {
    expect(isFullAccess('accepted_pending')).toBe(true);
    expect(isFullAccess('accepted')).toBe(true);
    expect(isFullAccess('declined')).toBe(false);
    expect(isFullAccess('declined_pending')).toBe(false);
    expect(isFullAccess('revocation_requested')).toBe(false);
    expect(isFullAccess(null)).toBe(false);
  });

  it('isDeclinedFlow covers all three decline-related states', () => {
    expect(isDeclinedFlow('declined')).toBe(true);
    expect(isDeclinedFlow('declined_pending')).toBe(true);
    expect(isDeclinedFlow('revocation_requested')).toBe(true);
    expect(isDeclinedFlow('accepted')).toBe(false);
    expect(isDeclinedFlow('accepted_pending')).toBe(false);
    expect(isDeclinedFlow(null)).toBe(false);
  });
});

describe('lib/guest — fetchers', () => {
  it('fetchGuestMe hits /api/guest/me and returns the payload', async () => {
    const payload = { guest_id: 1, firstname: 'A', lastname: 'B', type: 'solo', family_name: null, rsvp_status: null, rsvp_set_by: null, group_members: [] };
    api.get.mockResolvedValueOnce({ data: payload });
    const result = await fetchGuestMe();
    expect(api.get).toHaveBeenCalledWith('/api/guest/me');
    expect(result).toEqual(payload);
  });

  it('fetchEventInfo hits /api/event/info', async () => {
    const payload = { name: 'Wedding', date: '2026-08-01', rsvp_deadline: '2026-07-01' };
    api.get.mockResolvedValueOnce({ data: payload });
    const result = await fetchEventInfo();
    expect(api.get).toHaveBeenCalledWith('/api/event/info');
    expect(result).toEqual(payload);
  });

  it('fetchPhotoGameStatus hits /api/game/photo/status', async () => {
    api.get.mockResolvedValueOnce({ data: { status: 'active', assignment: null } });
    const result = await fetchPhotoGameStatus();
    expect(api.get).toHaveBeenCalledWith('/api/game/photo/status');
    expect(result.status).toBe('active');
  });
});

describe('lib/guest — mutators', () => {
  it('postRsvp sends the attending flag and returns the new status', async () => {
    api.post.mockResolvedValueOnce({ data: { rsvp_status: 'accepted_pending' } });
    const result = await postRsvp(true);
    expect(api.post).toHaveBeenCalledWith('/api/guest/rsvp', { attending: true });
    expect(result).toBe('accepted_pending');
  });

  it('postRsvp propagates a decline', async () => {
    api.post.mockResolvedValueOnce({ data: { rsvp_status: 'declined_pending' } });
    const result = await postRsvp(false);
    expect(api.post).toHaveBeenCalledWith('/api/guest/rsvp', { attending: false });
    expect(result).toBe('declined_pending');
  });

  it('postGroupRsvp URL-encodes the target guest id', async () => {
    api.post.mockResolvedValueOnce({ data: { guest_id: 99, rsvp_status: 'accepted' } });
    const result = await postGroupRsvp(99, true);
    expect(api.post).toHaveBeenCalledWith('/api/guest/99/rsvp', { attending: true });
    expect(result).toEqual({ guest_id: 99, rsvp_status: 'accepted' });
  });

  it('postRevoke calls the revocation endpoint', async () => {
    api.post.mockResolvedValueOnce({ data: { rsvp_status: 'revocation_requested' } });
    const result = await postRevoke();
    expect(api.post).toHaveBeenCalledWith('/api/guest/rsvp/revoke');
    expect(result).toBe('revocation_requested');
  });

  it('assignPhotoGameTask hits the assign endpoint', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 5, task: { id: 1, description: 'Take a jump shot' } } });
    const result = await assignPhotoGameTask();
    expect(api.post).toHaveBeenCalledWith('/api/game/photo/assign');
    expect(result.id).toBe(5);
  });

  it('submitPhotoGamePhoto builds a multipart body with the given uri', async () => {
    api.post.mockResolvedValueOnce({ data: { photo_url: 'https://cdn/x.jpg', submitted_at: '2026-07-03' } });
    const result = await submitPhotoGamePhoto('file:///tmp/x.jpg');

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, formData, opts] = api.post.mock.calls[0];
    expect(url).toBe('/api/game/photo/submit');
    // The FormData polyfill in Jest is available via node — we assert the
    // shape rather than the exact instance identity.
    expect(formData).toBeDefined();
    expect(opts).toEqual(
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: expect.any(Function),
      }),
    );
    expect(result.photo_url).toContain('.jpg');
  });

  it('submitPhotoGamePhoto transformRequest passes data through unchanged', async () => {
    api.post.mockResolvedValueOnce({ data: { photo_url: '', submitted_at: '' } });
    await submitPhotoGamePhoto('file:///tmp/x.jpg');
    const opts = api.post.mock.calls[0][2];
    const passthrough = { foo: 'bar' } as any;
    // The override disables axios' JSON serialisation — critical for
    // multipart uploads.
    expect(opts.transformRequest(passthrough)).toBe(passthrough);
  });
});
