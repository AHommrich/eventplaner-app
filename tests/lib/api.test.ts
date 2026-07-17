/**
 * `lib/api` — axios interceptors + block-state helpers.
 *
 * The axios mock lives ENTIRELY inside the jest.mock factory so it survives
 * Jest's hoisting rules (out-of-scope closures capture `undefined` when
 * accessed during the hoisted factory pass). Tests reach in via
 * `require('axios').default.__instance` to capture the interceptor
 * callbacks that `lib/api` registers at import time.
 */

jest.mock('axios', () => {
  const interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  const instance = {
    interceptors,
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  const axios: any = { create: jest.fn(() => instance) };
  axios.__instance = instance; // handle for tests to reach the captured interceptors
  return { __esModule: true, default: axios };
});

import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import apiDefault, {
  clearBlocked,
  registerDrinksBlockedHandler,
  clearDrinksBlockedHandler,
  resetDrinksBlocked,
  resetUnauthorizedRedirect,
} from '../../lib/api';

const axiosInstance = require('axios').default.__instance;
const requestInterceptor: (cfg: any) => Promise<any> =
  axiosInstance.interceptors.request.use.mock.calls[0][0];
const responseOnSuccess: (r: any) => any = axiosInstance.interceptors.response.use.mock.calls[0][0];
const responseOnError: (err: any) => any = axiosInstance.interceptors.response.use.mock.calls[0][1];

describe('lib/api — module wiring', () => {
  it('exports the created axios instance as default', () => {
    expect(apiDefault).toBe(axiosInstance);
  });

  it('registers exactly one request interceptor', () => {
    expect(axiosInstance.interceptors.request.use).toHaveBeenCalledTimes(1);
  });

  it('registers exactly one response interceptor with success + error handlers', () => {
    expect(axiosInstance.interceptors.response.use).toHaveBeenCalledTimes(1);
    expect(typeof responseOnSuccess).toBe('function');
    expect(typeof responseOnError).toBe('function');
  });
});

describe('lib/api — request interceptor', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('guest_token');
    await SecureStore.deleteItemAsync('management_token');
    await SecureStore.deleteItemAsync('management_active_event_id');
    await SecureStore.deleteItemAsync('app_language');
  });

  it('attaches a Bearer token when the session has one', async () => {
    await SecureStore.setItemAsync('guest_token', 'unit-token');
    const cfg = { headers: {} as Record<string, string> };
    const result = await requestInterceptor(cfg);
    expect(result.headers.Authorization).toBe('Bearer unit-token');
  });

  it('does not attach Authorization when no token is stored', async () => {
    const cfg = { headers: {} as Record<string, string> };
    const result = await requestInterceptor(cfg);
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('attaches management bearer and X-Event-ID to scoped management requests', async () => {
    await SecureStore.setItemAsync('management_token', 'management-token');
    await SecureStore.setItemAsync('management_active_event_id', '17');
    const cfg = { url: '/api/management/notes', headers: {} as Record<string, string> };

    const result = await requestInterceptor(cfg);
    expect(result.headers.Authorization).toBe('Bearer management-token');
    expect(result.headers['X-Event-ID']).toBe('17');
  });

  it('never attaches a management bearer to a guest endpoint', async () => {
    await SecureStore.setItemAsync('management_token', 'management-token');
    const cfg = { url: '/api/drinks', headers: {} as Record<string, string> };

    const result = await requestInterceptor(cfg);
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('preserves an explicit pending-revocation bearer on logout', async () => {
    await SecureStore.setItemAsync('management_token', 'new-management-token');
    const cfg = {
      url: '/api/auth/logout',
      headers: { Authorization: 'Bearer pending-old-token' } as Record<string, string>,
    };

    const result = await requestInterceptor(cfg);
    expect(result.headers.Authorization).toBe('Bearer pending-old-token');
  });

  it('omits X-Event-ID for management event bootstrap', async () => {
    await SecureStore.setItemAsync('management_token', 'management-token');
    await SecureStore.setItemAsync('management_active_event_id', '17');
    const cfg = { url: '/api/management/me/events', headers: {} as Record<string, string> };

    const result = await requestInterceptor(cfg);
    expect(result.headers.Authorization).toBe('Bearer management-token');
    expect(result.headers['X-Event-ID']).toBeUndefined();
  });

  it('defaults Accept-Language to de when no language is persisted', async () => {
    const cfg = { headers: {} as Record<string, string> };
    const result = await requestInterceptor(cfg);
    expect(result.headers['Accept-Language']).toBe('de');
  });

  it('uses the persisted language when one is stored', async () => {
    await SecureStore.setItemAsync('app_language', 'en');
    const cfg = { headers: {} as Record<string, string> };
    const result = await requestInterceptor(cfg);
    expect(result.headers['Accept-Language']).toBe('en');
  });
});

describe('lib/api — response interceptor', () => {
  beforeEach(async () => {
    clearBlocked();
    clearDrinksBlockedHandler();
    resetUnauthorizedRedirect();
    await SecureStore.deleteItemAsync('guest_token');
    await SecureStore.deleteItemAsync('guest_id');
    await SecureStore.deleteItemAsync('guest_firstname');
    await SecureStore.deleteItemAsync('guest_lastname');
    await SecureStore.deleteItemAsync('guest_type');
    await SecureStore.deleteItemAsync('guest_family_name');
    await SecureStore.deleteItemAsync('management_token');
    await SecureStore.deleteItemAsync('management_user_id');
    (router.replace as jest.Mock).mockClear();
  });

  it('passes successful responses through untouched', () => {
    const response = { data: 'ok', status: 200 };
    expect(responseOnSuccess(response)).toBe(response);
  });

  it('routes to /blocked on a 403 app_blocked and debounces subsequent hits', () => {
    responseOnError({
      response: { status: 403, data: { code: 'app_blocked' } },
    });
    expect(router.replace).toHaveBeenCalledWith('/blocked');
    // Second 403 in the same window is swallowed — the internal debounce
    // prevents a duplicate router.replace call.
    responseOnError({
      response: { status: 403, data: { code: 'app_blocked' } },
    });
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('clearBlocked resets the debounce so the next 403 fires again', () => {
    responseOnError({
      response: { status: 403, data: { code: 'app_blocked' } },
    });
    clearBlocked();
    responseOnError({
      response: { status: 403, data: { code: 'app_blocked' } },
    });
    expect(router.replace).toHaveBeenCalledTimes(2);
  });

  it('fires the registered drinks_blocked handler exactly once until reset', () => {
    const handler = jest.fn();
    registerDrinksBlockedHandler(handler);
    responseOnError({ response: { data: { code: 'drinks_blocked' } } });
    responseOnError({ response: { data: { code: 'drinks_blocked' } } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resetDrinksBlocked lets the handler fire again on the next block', () => {
    const handler = jest.fn();
    registerDrinksBlockedHandler(handler);
    responseOnError({ response: { data: { code: 'drinks_blocked' } } });
    resetDrinksBlocked();
    responseOnError({ response: { data: { code: 'drinks_blocked' } } });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('clears the local session and routes to / on authenticated 401s', async () => {
    await SecureStore.setItemAsync('guest_token', 'expired-token');
    await SecureStore.setItemAsync('guest_id', '42');
    await SecureStore.setItemAsync('guest_firstname', 'Ada');
    await SecureStore.setItemAsync('guest_lastname', 'Lovelace');
    await SecureStore.setItemAsync('guest_type', 'solo');
    await SecureStore.setItemAsync('guest_family_name', 'Lovelace');

    responseOnError({
      config: { url: '/api/guest/me', headers: { Authorization: 'Bearer expired-token' } },
      response: { status: 401, data: {} },
    });
    await Promise.resolve();

    expect(await SecureStore.getItemAsync('guest_token')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_id')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_firstname')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_lastname')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_type')).toBeNull();
    expect(await SecureStore.getItemAsync('guest_family_name')).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('does not treat unauthenticated QR/login 401s as session expiry', async () => {
    const err = {
      config: { url: '/api/auth/qr/bad-token', headers: {} },
      response: { status: 401, data: {} },
    };
    await expect(responseOnError(err)).rejects.toBe(err);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('clears a rejected management session and routes to the shared welcome scanner', async () => {
    resetUnauthorizedRedirect();
    await SecureStore.setItemAsync('management_token', 'expired-management-token');
    await SecureStore.setItemAsync('management_user_id', '5');

    responseOnError({
      config: {
        url: '/api/management/me/events',
        headers: { Authorization: 'Bearer expired-management-token' },
      },
      response: { status: 401, data: {} },
    });
    await Promise.resolve();

    expect(await SecureStore.getItemAsync('management_token')).toBeNull();
    expect(await SecureStore.getItemAsync('management_user_id')).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('lets logout 401s bubble so clearSession can finish local cleanup', async () => {
    const err = {
      config: { url: '/api/auth/logout', headers: { Authorization: 'Bearer expired-token' } },
      response: { status: 401, data: {} },
    };
    await expect(responseOnError(err)).rejects.toBe(err);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('rejects unrelated errors verbatim', async () => {
    const err = { response: { status: 500, data: {} } };
    await expect(responseOnError(err)).rejects.toBe(err);
  });
});
