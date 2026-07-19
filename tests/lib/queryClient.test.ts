/**
 * `lib/queryClient` — the shared TanStack Query retry policy.
 *
 * The predicate is exported (not just wired into the singleton) because
 * `tests/setupAfterEnv.ts` overrides the client's `retry` to `false` per test,
 * which would otherwise make this logic unreachable from a test.
 */
import { shouldRetryQuery } from '../../lib/queryClient';
import { HandledApiError } from '../../lib/api';

const withStatus = (status: number) => ({ response: { status } });

describe('lib/queryClient — shouldRetryQuery', () => {
  it('never retries a globally-handled error', () => {
    expect(shouldRetryQuery(0, new HandledApiError('app_blocked'))).toBe(false);
  });

  it('never retries a definitive 4xx client error', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(shouldRetryQuery(0, withStatus(status))).toBe(false);
    }
  });

  it('retries the two retryable 4xx (408, 429) within the cap', () => {
    expect(shouldRetryQuery(0, withStatus(408))).toBe(true);
    expect(shouldRetryQuery(0, withStatus(429))).toBe(true);
  });

  it('retries transient network / 5xx failures within the cap', () => {
    expect(shouldRetryQuery(0, new Error('network'))).toBe(true);
    expect(shouldRetryQuery(1, withStatus(500))).toBe(true);
  });

  it('stops retrying once the failure-count cap is reached', () => {
    expect(shouldRetryQuery(2, withStatus(500))).toBe(false);
    expect(shouldRetryQuery(2, new Error('network'))).toBe(false);
  });
});
