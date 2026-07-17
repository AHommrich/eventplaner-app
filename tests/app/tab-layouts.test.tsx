import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockUseEventTheme = jest.fn();
jest.mock('../../lib/EventThemeContext', () => ({
  useEventTheme: () => mockUseEventTheme(),
}));
jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: (props: any) => React.createElement(View, props) };
});

import { EventTabShell } from '../../components/EventTabShell';
import { GUEST_TAB_MANIFEST } from '../../app/(tabs)/_layout';
import { getOrganizerTabManifest, ORGANIZER_TAB_MANIFEST } from '../../app/organizer/_layout';

function eventTheme(tabBar: 'classic' | 'sheet') {
  return {
    colors: {
      navBg: '#fff7f4',
      border: '#7f2633',
      tabTint: '#7f2633',
      fontFamily: undefined,
    },
    variant: {
      tabBar,
      tabBarRadius: 24,
    },
  };
}

describe('shared event tab layouts', () => {
  it.each(['owner', 'event_admin', 'event_manager'] as const)(
    'keeps the exact organizer manifest for %s',
    (role) => {
      expect(getOrganizerTabManifest(role)).toEqual([
        'index',
        'schedule',
        'photos',
        'notes',
        'settings',
      ]);
    }
  );

  it('keeps the guest route manifest unchanged', () => {
    expect(GUEST_TAB_MANIFEST).toEqual([
      'home',
      'schedule',
      'rsvp',
      'photos',
      'photo-game',
      'drinks',
      'settings',
    ]);
    expect(ORGANIZER_TAB_MANIFEST).toHaveLength(5);
  });

  it.each(['classic', 'sheet'] as const)('renders the shared shell in %s mode', (tabBar) => {
    mockUseEventTheme.mockReturnValue(eventTheme(tabBar));
    const { getByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <EventTabShell icons={{ index: 'grid-outline' }}>
          <Text>Organizer content</Text>
        </EventTabShell>
      </SafeAreaProvider>
    );

    expect(getByText('Organizer content')).toBeTruthy();
  });
});
