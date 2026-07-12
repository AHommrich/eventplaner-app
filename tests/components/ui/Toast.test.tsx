import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { EventThemeProvider } from '../../../lib/EventThemeContext';
import { Toast } from '../../../components/ui/Toast';

jest.mock('../../../lib/guest', () => ({
  __esModule: true,
  fetchEventInfo: jest.fn().mockResolvedValue({}),
}));

// Same rationale as tests/app/tabs-home.test.tsx — the Jest tree has no
// `SafeAreaProvider`, so the real hook would warn and return a placeholder.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

describe('components/ui/Toast', () => {
  it('renders its children when visible', () => {
    const { getByText } = render(
      <EventThemeProvider>
        <Toast visible testID="my-toast">
          <Text>Saved</Text>
        </Toast>
      </EventThemeProvider>
    );
    expect(getByText('Saved')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <EventThemeProvider>
        <Toast visible={false} testID="my-toast">
          <Text>Saved</Text>
        </Toast>
      </EventThemeProvider>
    );
    expect(queryByText('Saved')).toBeNull();
  });
});
