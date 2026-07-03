/**
 * `app/erasure-pending.tsx` — Art. 17 GDPR pending-erasure surface.
 *
 * Covers:
 *   - No local erasure state → redirect back to `/` (the safeguard for
 *     deep-links / browser-back arrivals).
 *   - State present + still-in-window → renders the recovery token + revoke
 *     button + logout row.
 *   - Copy-token button writes to the clipboard.
 */
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetErasureState = jest.fn();
jest.mock('../../lib/erasure', () => ({
  __esModule: true,
  getErasureState: (...a: any[]) => mockGetErasureState(...a),
  clearErasureState: jest.fn(async () => {}),
}));

jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return { __esModule: true, ...actual, revokeErasure: jest.fn() };
});

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import ErasurePendingScreen from '../../app/erasure-pending';
import { LanguageProvider } from '../../lib/LanguageContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <ErasurePendingScreen />
    </LanguageProvider>,
  );
}

describe('app/erasure-pending', () => {
  beforeEach(() => {
    mockGetErasureState.mockReset();
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    (router.replace as jest.Mock).mockClear();
  });

  it('redirects to `/` when no erasure state is present', async () => {
    mockGetErasureState.mockResolvedValue(null);

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('renders the recovery token when the erasure is still in-window', async () => {
    mockGetErasureState.mockResolvedValue({
      recoveryToken: 'RECOVERY-XYZ-1234',
      scheduledAt: '2026-06-01T00:00:00Z',
      canRevokeUntil: '2099-06-01T00:00:00Z',
    });

    const { findByText } = renderScreen();

    // The token itself is rendered so the guest can screenshot or copy it.
    await findByText('RECOVERY-XYZ-1234');
    await findByText('Löschantrag widerrufen');
    // No auto-redirect fired.
    expect(router.replace).not.toHaveBeenCalledWith('/');
  });

  it('tapping copy writes the recovery token to the clipboard', async () => {
    mockGetErasureState.mockResolvedValue({
      recoveryToken: 'RECOVERY-XYZ-1234',
      scheduledAt: '2026-06-01T00:00:00Z',
      canRevokeUntil: '2099-06-01T00:00:00Z',
    });

    const { findByText } = renderScreen();
    const copy = await findByText('Code kopieren');

    fireEvent.press(copy);

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('RECOVERY-XYZ-1234');
    });
  });
});
