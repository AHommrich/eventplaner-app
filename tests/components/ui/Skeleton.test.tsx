import React from 'react';
import { render } from '@testing-library/react-native';
import { LanguageProvider } from '../../../lib/LanguageContext';
import { EventThemeProvider } from '../../../lib/EventThemeContext';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PhotoGridSkeleton, CardSkeleton, ListSkeleton } from '../../../components/ui/ScreenSkeletons';

jest.mock('../../../lib/guest', () => ({
  __esModule: true,
  fetchEventInfo: jest.fn().mockResolvedValue({}),
}));

function withProviders(children: React.ReactNode) {
  return (
    <LanguageProvider>
      <EventThemeProvider>{children}</EventThemeProvider>
    </LanguageProvider>
  );
}

describe('components/ui/Skeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(withProviders(<Skeleton width={100} height={20} />));
    expect(toJSON()).toBeTruthy();
  });
});

describe('components/ui/ScreenSkeletons', () => {
  it('renders a photo grid skeleton', () => {
    const { toJSON } = render(withProviders(<PhotoGridSkeleton rows={2} />));
    expect(toJSON()).toBeTruthy();
  });

  it('renders a card skeleton with a button', () => {
    const { toJSON } = render(withProviders(<CardSkeleton lines={4} showButton />));
    expect(toJSON()).toBeTruthy();
  });

  it('renders a list skeleton', () => {
    const { toJSON } = render(withProviders(<ListSkeleton rows={3} />));
    expect(toJSON()).toBeTruthy();
  });
});
