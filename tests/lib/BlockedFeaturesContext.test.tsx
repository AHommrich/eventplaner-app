/**
 * `BlockedFeaturesContext` — drinks-block polling glue.
 *
 * Names starting with `mock` are the only out-of-scope identifiers Jest
 * permits inside a `jest.mock()` factory (documented in the Jest hoisting
 * rules); every captured spy therefore carries the `mock*` prefix.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';

const mockApiGet = jest.fn();
const mockRegisterHandler = jest.fn();
const mockClearHandler = jest.fn();
const mockResetBlocked = jest.fn();

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: (...args: any[]) => mockApiGet(...args) },
  registerDrinksBlockedHandler: (fn: () => void) => mockRegisterHandler(fn),
  clearDrinksBlockedHandler: () => mockClearHandler(),
  resetDrinksBlocked: () => mockResetBlocked(),
}));

import { BlockedFeaturesProvider, useBlockedFeatures } from '../../lib/BlockedFeaturesContext';

function Probe() {
  const { drinksBlocked } = useBlockedFeatures();
  return <Text testID="blocked">{drinksBlocked ? 'BLOCKED' : 'OPEN'}</Text>;
}

describe('lib/BlockedFeaturesContext', () => {
  let capturedHandler: (() => void) | null = null;

  beforeEach(() => {
    mockApiGet.mockReset();
    mockRegisterHandler.mockReset();
    mockClearHandler.mockReset();
    mockResetBlocked.mockReset();
    capturedHandler = null;
    mockRegisterHandler.mockImplementation((fn: () => void) => {
      capturedHandler = fn;
    });
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers a handler on mount and probes the drinks endpoint', () => {
    mockApiGet.mockResolvedValue({ data: [] });
    render(
      <BlockedFeaturesProvider>
        <Probe />
      </BlockedFeaturesProvider>
    );
    expect(mockRegisterHandler).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/api/drinks');
  });

  it('flips drinksBlocked to true when the interceptor handler fires', () => {
    mockApiGet.mockResolvedValue({ data: [] });
    const { getByTestId } = render(
      <BlockedFeaturesProvider>
        <Probe />
      </BlockedFeaturesProvider>
    );
    expect(getByTestId('blocked').props.children).toBe('OPEN');

    act(() => {
      capturedHandler?.();
    });
    expect(getByTestId('blocked').props.children).toBe('BLOCKED');
  });

  it('polls while blocked and re-opens drinks after a successful probe', async () => {
    mockApiGet.mockResolvedValue({ data: [] });
    const { getByTestId } = render(
      <BlockedFeaturesProvider>
        <Probe />
      </BlockedFeaturesProvider>
    );

    act(() => {
      capturedHandler?.();
    });
    expect(getByTestId('blocked').props.children).toBe('BLOCKED');

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(mockResetBlocked).toHaveBeenCalledTimes(1);
    expect(getByTestId('blocked').props.children).toBe('OPEN');
  });

  it('keeps polling when a blocked-state probe fails', async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error('offline'));
    const { getByTestId } = render(
      <BlockedFeaturesProvider>
        <Probe />
      </BlockedFeaturesProvider>
    );

    act(() => {
      capturedHandler?.();
    });
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(mockResetBlocked).not.toHaveBeenCalled();
    expect(getByTestId('blocked').props.children).toBe('BLOCKED');
  });

  it('detaches the handler on unmount to prevent leaks', () => {
    mockApiGet.mockResolvedValue({ data: [] });
    const { unmount } = render(
      <BlockedFeaturesProvider>
        <Probe />
      </BlockedFeaturesProvider>
    );
    unmount();
    expect(mockClearHandler).toHaveBeenCalledTimes(1);
  });
});
