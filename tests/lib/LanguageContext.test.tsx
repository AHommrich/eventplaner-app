/**
 * `LanguageContext` — persistence + auto-detect + fallback picker.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

const mockGetLocales = jest.fn();
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

// Import AFTER the mock definition so the module picks up our spy.
import { LanguageProvider, useLanguage } from '../../lib/LanguageContext';

function Probe() {
  const { language, needsLanguagePick, setLanguage } = useLanguage();
  return (
    <>
      <Text testID="lang">{language}</Text>
      <Text testID="pick">{needsLanguagePick ? 'YES' : 'NO'}</Text>
      <Text testID="switch" onPress={() => setLanguage('en')}>
        switch
      </Text>
    </>
  );
}

describe('lib/LanguageContext', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('app_language');
    mockGetLocales.mockReset();
    mockGetLocales.mockReturnValue([{ languageCode: 'de', regionCode: 'DE' }]);
  });

  it('honours a persisted language even when the device disagrees', async () => {
    await SecureStore.setItemAsync('app_language', 'en');
    mockGetLocales.mockReturnValue([{ languageCode: 'de', regionCode: 'DE' }]);

    const { getByTestId } = render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => expect(getByTestId('lang').props.children).toBe('en'));
    expect(getByTestId('pick').props.children).toBe('NO');
  });

  it('auto-detects a supported device language when nothing is persisted', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en', regionCode: 'US' }]);

    const { getByTestId } = render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => expect(getByTestId('lang').props.children).toBe('en'));
    expect(getByTestId('pick').props.children).toBe('NO');
  });

  it('flags needsLanguagePick when the device speaks something unsupported', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'fr', regionCode: 'FR' }]);

    const { getByTestId } = render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => expect(getByTestId('pick').props.children).toBe('YES'));
  });

  it('setLanguage persists the choice and clears the picker flag', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'fr', regionCode: 'FR' }]);

    const { getByTestId } = render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => expect(getByTestId('pick').props.children).toBe('YES'));

    await act(async () => {
      getByTestId('switch').props.onPress();
    });

    await waitFor(() => expect(getByTestId('lang').props.children).toBe('en'));
    expect(getByTestId('pick').props.children).toBe('NO');
    expect(await SecureStore.getItemAsync('app_language')).toBe('en');
  });
});
