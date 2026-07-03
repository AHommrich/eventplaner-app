/**
 * `app/index.tsx` — welcome / entry screen.
 *
 * The interesting logic is the on-mount redirect matrix:
 *   - no session, no pending erasure       → welcome (buttons visible)
 *   - no session, pending erasure          → `/erasure-pending`
 *   - session + rsvp_status = null         → `/rsvp` onboarding
 *   - session + accepted / accepted_pending → `/(tabs)/home`
 *   - session + declined / declined_pending / revocation_requested → `/declined`
 *
 * The gallery-QR fallback flow is complex enough to deserve its own suite
 * (Phase 12 verification covers the live scanner). Here we cover the redirect
 * matrix — that's where a stale mock or a copy-paste bug would silently send
 * a returning guest to the wrong screen.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockGetSession = jest.fn();
jest.mock('../../lib/auth', () => ({
  __esModule: true,
  getSession: (...args: any[]) => mockGetSession(...args),
  saveSession: jest.fn(),
}));

const mockFetchGuestMe = jest.fn();
jest.mock('../../lib/guest', () => {
  const actual = jest.requireActual('../../lib/guest');
  return {
    __esModule: true,
    ...actual,
    fetchGuestMe: (...args: any[]) => mockFetchGuestMe(...args),
  };
});

const mockGetErasureState = jest.fn();
jest.mock('../../lib/erasure', () => ({
  __esModule: true,
  getErasureState: (...args: any[]) => mockGetErasureState(...args),
}));

// `lib/api` is imported eagerly by other lib files; a light default satisfies
// the type without hitting the real axios interceptor stack.
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// `QrFromImageView` renders a real WebView; in tests it's a no-op.
jest.mock('../../lib/QrFromImage', () => ({
  __esModule: true,
  QrFromImageView: () => null,
}));

import WelcomeScreen from '../../app/index';
import { LanguageProvider } from '../../lib/LanguageContext';
import { EventThemeProvider } from '../../lib/EventThemeContext';

function renderScreen() {
  return render(
    <LanguageProvider>
      <EventThemeProvider>
        <WelcomeScreen />
      </EventThemeProvider>
    </LanguageProvider>,
  );
}

describe('app/index — redirect matrix', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockFetchGuestMe.mockReset();
    mockGetErasureState.mockReset();
    (router.replace as jest.Mock).mockClear();
  });

  it('no session + no erasure → stays on welcome and shows the scan button', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetErasureState.mockResolvedValue(null);

    const { findByText } = renderScreen();

    // `welcome.scanButton` in DE.
    await findByText(/QR-Code scannen|Scan QR/i);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('no session + pending erasure → routes to `/erasure-pending`', async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetErasureState.mockResolvedValue({
      recoveryToken: 't',
      scheduledAt: '2026-07-01T00:00:00Z',
      canRevokeUntil: '2026-08-01T00:00:00Z',
    });

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/erasure-pending'));
  });

  it('session + rsvp_status null → routes to onboarding rsvp', async () => {
    mockGetSession.mockResolvedValue({ token: 't', guestId: 1 });
    mockFetchGuestMe.mockResolvedValue({ rsvp_status: null });

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/rsvp'));
  });

  it('session + accepted → routes to tabs/home', async () => {
    mockGetSession.mockResolvedValue({ token: 't', guestId: 1 });
    mockFetchGuestMe.mockResolvedValue({ rsvp_status: 'accepted' });

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/home'));
  });

  it('session + declined_pending → routes to /declined', async () => {
    mockGetSession.mockResolvedValue({ token: 't', guestId: 1 });
    mockFetchGuestMe.mockResolvedValue({ rsvp_status: 'declined_pending' });

    renderScreen();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/declined'));
  });

  it('session but backend unreachable → stays on welcome so guest can retry', async () => {
    mockGetSession.mockResolvedValue({ token: 't', guestId: 1 });
    mockFetchGuestMe.mockRejectedValue(new Error('network down'));

    const { findByText } = renderScreen();

    // Welcome is reachable — the failure path clears `checking` and re-shows
    // the scan button rather than trapping the guest on a blank screen.
    await findByText(/QR-Code scannen|Scan QR/i);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
