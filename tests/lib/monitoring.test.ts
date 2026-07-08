describe('lib/monitoring', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    delete process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadMonitoring({
    dsn = '',
    tracesSampleRate,
    executionEnvironment = 'standalone',
    sentry = { init: jest.fn(), captureException: jest.fn() },
  }: {
    dsn?: string;
    tracesSampleRate?: string;
    executionEnvironment?: string;
    sentry?: { init: jest.Mock; captureException: jest.Mock };
  }) {
    if (dsn) process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
    if (tracesSampleRate !== undefined) {
      process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = tracesSampleRate;
    }

    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment },
    }));
    jest.doMock('@sentry/react-native', () => ({
      __esModule: true,
      ...sentry,
    }));

    const monitoring = require('../../lib/monitoring');
    return { monitoring, sentry };
  }

  it('does not initialize Sentry without a DSN', async () => {
    const { monitoring, sentry } = await loadMonitoring({});

    await monitoring.initMonitoring();
    await expect(monitoring.captureSentryTestError()).resolves.toBe(false);

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not initialize inside Expo Go', async () => {
    const { monitoring, sentry } = await loadMonitoring({
      dsn: 'https://example@sentry.invalid/1',
      executionEnvironment: 'storeClient',
    });

    await monitoring.initMonitoring();
    await expect(monitoring.captureSentryTestError()).resolves.toBe(false);

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry once with privacy-safe options', async () => {
    const { monitoring, sentry } = await loadMonitoring({
      dsn: 'https://example@sentry.invalid/1',
      tracesSampleRate: '0.25',
    });

    await monitoring.initMonitoring();
    await monitoring.initMonitoring();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://example@sentry.invalid/1',
        enabled: true,
        sendDefaultPii: false,
        tracesSampleRate: 0.25,
      })
    );
  });

  it('strips user and auth headers before sending an event', async () => {
    const { monitoring, sentry } = await loadMonitoring({
      dsn: 'https://example@sentry.invalid/1',
      tracesSampleRate: 'not-a-number',
    });

    await monitoring.initMonitoring();
    const options = sentry.init.mock.calls[0][0];
    const event = {
      user: { id: 'guest-1' },
      request: {
        headers: {
          Authorization: 'Bearer token',
          authorization: 'Bearer lower-token',
          Cookie: 'sid=123',
          cookie: 'sid=456',
          Accept: 'application/json',
        },
      },
    };

    expect(options.beforeSend(event)).toEqual({
      request: { headers: { Accept: 'application/json' } },
    });
    expect(options.beforeSend({ message: 'no request' })).toEqual({ message: 'no request' });
    expect(options.tracesSampleRate).toBe(0);
  });

  it('resets initialization state when Sentry init fails so a later retry can work', async () => {
    const sentry = {
      init: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('native module unavailable');
        })
        .mockImplementationOnce(() => undefined),
      captureException: jest.fn(),
    };
    const { monitoring } = await loadMonitoring({
      dsn: 'https://example@sentry.invalid/1',
      sentry,
    });

    await monitoring.initMonitoring();
    await monitoring.initMonitoring();

    expect(sentry.init).toHaveBeenCalledTimes(2);
  });

  it('captures the manual Sentry test error after initialization', async () => {
    const { monitoring, sentry } = await loadMonitoring({
      dsn: 'https://example@sentry.invalid/1',
    });

    await expect(monitoring.captureSentryTestError()).resolves.toBe(true);

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException.mock.calls[0][0]).toEqual(
      expect.objectContaining({ message: 'eveplan Sentry test error' })
    );
  });
});
