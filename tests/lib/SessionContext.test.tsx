/**
 * `useSessionScope` — the reactive bridge over the session cache (Checkpoint 1).
 *
 * A module-level cache does not re-render React on its own; this confirms the
 * `useSyncExternalStore` wiring re-renders consumers when the scope changes on
 * login and clears it on logout.
 */
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useSessionScope } from '../../lib/SessionContext';
import { setCached, mintSessionId } from '../../lib/sessionCache';
import { deleteGuestSession } from '../../lib/sessionStorage';

function Probe() {
  const scope = useSessionScope();
  return <Text>{scope ? `${scope.actor}` : 'none'}</Text>;
}

describe('useSessionScope', () => {
  it('re-renders none → guest on login and back to none on logout', async () => {
    const { getByText } = render(<Probe />);
    getByText('none');

    await act(async () => {
      await setCached('guest_token', 't');
      await setCached('guest_id', '7');
      await mintSessionId();
    });
    getByText('guest');

    await act(async () => {
      await deleteGuestSession();
    });
    getByText('none');
  });
});
