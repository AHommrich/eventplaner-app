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
  beforeEach(() => {
    clearBlocked();
    clearDrinksBlockedHandler();
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

  it('rejects unrelated errors verbatim', async () => {
    const err = { response: { status: 500, data: {} } };
    await expect(responseOnError(err)).rejects.toBe(err);
  });
});
