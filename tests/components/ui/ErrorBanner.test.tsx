import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { LanguageProvider } from '../../../lib/LanguageContext';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';

describe('components/ui/ErrorBanner', () => {
  it('renders the message', () => {
    const { getByText } = render(
      <LanguageProvider>
        <ErrorBanner message="Etwas ist schiefgelaufen." />
      </LanguageProvider>
    );
    expect(getByText('Etwas ist schiefgelaufen.')).toBeTruthy();
  });

  it('does not render a retry button when onRetry is omitted', () => {
    const { queryByTestId } = render(
      <LanguageProvider>
        <ErrorBanner message="Fehler" />
      </LanguageProvider>
    );
    expect(queryByTestId('error-banner-retry')).toBeNull();
  });

  it('calls onRetry when the retry button is pressed', () => {
    const onRetry = jest.fn();
    const { getByTestId } = render(
      <LanguageProvider>
        <ErrorBanner message="Fehler" onRetry={onRetry} />
      </LanguageProvider>
    );
    fireEvent.press(getByTestId('error-banner-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
