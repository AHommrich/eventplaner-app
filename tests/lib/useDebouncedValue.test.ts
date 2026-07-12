import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

describe('lib/useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 200));
    expect(result.current).toBe('a');
  });

  it('delays updates until the timeout elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(199);
    });
    expect(result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('resets the timer on rapid successive changes', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'ab' });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    rerender({ value: 'abc' });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current).toBe('abc');
  });
});
