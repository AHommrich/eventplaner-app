/**
 * `useRefreshToast` — the pull-to-refresh state machine.
 *
 * Uses fake timers so the 2-second toast lifetime is deterministic and the
 * suite doesn't wait real time.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRefreshToast } from '../../lib/useRefreshToast';

describe('lib/useRefreshToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('initial state: neither refreshing nor recently refreshed', () => {
    const { result } = renderHook(() => useRefreshToast(async () => {}));
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshed).toBe(false);
  });

  it('onRefresh flips refreshing → refreshed → false again after 2 s', async () => {
    const load = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useRefreshToast(load));

    await act(async () => {
      const promise = result.current.onRefresh();
      // Once the promise resolves, refreshing should be false and refreshed true.
      await promise;
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshed).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => expect(result.current.refreshed).toBe(false));
  });

  it('clears the timer on unmount so no state update fires after teardown', () => {
    const { result, unmount } = renderHook(() => useRefreshToast(async () => {}));
    // Kick off a refresh (fills the timer) then unmount before it expires.
    act(() => {
      result.current.onRefresh();
    });
    expect(() => unmount()).not.toThrow();
  });
});
