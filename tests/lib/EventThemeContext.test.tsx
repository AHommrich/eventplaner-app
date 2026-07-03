/**
 * `EventThemeContext` — palette + font resolution driven by the backend.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

const mockFetchEventInfo = jest.fn();
jest.mock('../../lib/guest', () => ({
  __esModule: true,
  fetchEventInfo: () => mockFetchEventInfo(),
}));

import { EventThemeProvider, useEventTheme } from '../../lib/EventThemeContext';

function Probe() {
  const { colors, eventInfo, loadTheme } = useEventTheme();
  return (
    <>
      <Text testID="primary">{colors.primary}</Text>
      <Text testID="cardText">{colors.cardText}</Text>
      <Text testID="homeText">{colors.homeText ?? 'null'}</Text>
      <Text testID="font">{colors.fontFamily?.regular ?? 'system'}</Text>
      <Text testID="name">{eventInfo?.name ?? 'unset'}</Text>
      <Text testID="reload" onPress={() => loadTheme()}>
        reload
      </Text>
    </>
  );
}

describe('lib/EventThemeContext', () => {
  beforeEach(async () => {
    mockFetchEventInfo.mockReset();
    await SecureStore.deleteItemAsync('guest_token');
  });

  it('falls back to the hard-coded palette when no session is active', async () => {
    const { getByTestId } = render(
      <EventThemeProvider>
        <Probe />
      </EventThemeProvider>,
    );
    // Fallback burgundy from the file header.
    await waitFor(() => expect(getByTestId('primary').props.children).toBe('#7c2d3e'));
    expect(mockFetchEventInfo).not.toHaveBeenCalled();
  });

  it('applies backend colours when the session fetch succeeds', async () => {
    await SecureStore.setItemAsync('guest_token', 'x');
    mockFetchEventInfo.mockResolvedValueOnce({
      name: 'Test wedding',
      color_primary: '#000001',
      color_card_text: '#000002',
      color_home_text: '#000003',
      color_home_shadow: '#000004',
      home_shadow_opacity: 25,
      font_heading: 'playfair',
    });

    const { getByTestId } = render(
      <EventThemeProvider>
        <Probe />
      </EventThemeProvider>,
    );

    await waitFor(() => expect(getByTestId('primary').props.children).toBe('#000001'));
    expect(getByTestId('cardText').props.children).toBe('#000002');
    expect(getByTestId('homeText').props.children).toBe('#000003');
    expect(getByTestId('font').props.children).toBe('PlayfairDisplay_400Regular');
    expect(getByTestId('name').props.children).toBe('Test wedding');
  });

  it('leaves colours at their fallback when a role is null on the backend', async () => {
    await SecureStore.setItemAsync('guest_token', 'x');
    mockFetchEventInfo.mockResolvedValueOnce({
      name: 'Partial theme',
      color_primary: null,
      color_card_text: null,
      color_home_text: null,
      font_heading: null,
    });

    const { getByTestId } = render(
      <EventThemeProvider>
        <Probe />
      </EventThemeProvider>,
    );

    await waitFor(() => expect(getByTestId('name').props.children).toBe('Partial theme'));
    expect(getByTestId('primary').props.children).toBe('#7c2d3e');
    // Unknown font key → system fallback (fontFamily undefined).
    expect(getByTestId('font').props.children).toBe('system');
  });

  it('loadTheme re-fetches so mid-event palette changes propagate', async () => {
    await SecureStore.setItemAsync('guest_token', 'x');
    mockFetchEventInfo
      .mockResolvedValueOnce({ name: 'First', color_primary: '#111111' })
      .mockResolvedValueOnce({ name: 'Second', color_primary: '#222222' });

    const { getByTestId } = render(
      <EventThemeProvider>
        <Probe />
      </EventThemeProvider>,
    );

    await waitFor(() => expect(getByTestId('primary').props.children).toBe('#111111'));

    await act(async () => {
      getByTestId('reload').props.onPress();
    });

    await waitFor(() => expect(getByTestId('primary').props.children).toBe('#222222'));
  });

  it('survives a failed fetch by keeping the current palette in place', async () => {
    await SecureStore.setItemAsync('guest_token', 'x');
    mockFetchEventInfo.mockRejectedValueOnce(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getByTestId } = render(
      <EventThemeProvider>
        <Probe />
      </EventThemeProvider>,
    );

    // No re-fetch was triggered by loadTheme in this test — the initial
    // mount call is the one that fails, so we simply verify the palette
    // stays at its fallback and no crash bubbles up.
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(getByTestId('primary').props.children).toBe('#7c2d3e');
    warn.mockRestore();
  });
});
