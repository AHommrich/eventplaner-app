import { Alert, Linking, Platform } from 'react-native';
import { openLocationInMaps } from '../../lib/maps';

const t = (k: string) => k;

describe('lib/maps openLocationInMaps', () => {
  beforeEach(() => {
    (Linking.openURL as jest.Mock).mockReset();
    (Linking.openURL as jest.Mock).mockResolvedValue(true);
  });

  it('offers Apple and Google Maps with exact coordinates on iOS', () => {
    Platform.OS = 'ios';
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    openLocationInMaps({ name: 'Party', address: 'Dernbach 1', lat: 50.5, lng: 7.5 }, t);

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttons).toHaveLength(3);

    buttons[0].onPress?.();
    expect(Linking.openURL).toHaveBeenCalledWith('maps://?ll=50.5,7.5&q=Party');

    buttons[1].onPress?.();
    expect(Linking.openURL).toHaveBeenCalledWith('comgooglemaps://?q=50.5,7.5&zoom=16');

    alertSpy.mockRestore();
  });

  it('geocodes the address on iOS when there are no coordinates', () => {
    Platform.OS = 'ios';
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    openLocationInMaps({ address: 'Dernbach 1' }, t);

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons[0].onPress?.();
    expect(Linking.openURL).toHaveBeenCalledWith('maps://?q=Dernbach%201');

    alertSpy.mockRestore();
  });

  it('opens a geo: link directly on Android with the pinned coordinates', () => {
    Platform.OS = 'android';

    openLocationInMaps({ name: 'Party', lat: 50.5, lng: 7.5 }, t);

    expect(Linking.openURL).toHaveBeenCalledWith('geo:50.5,7.5?q=50.5,7.5(Party)');
    Platform.OS = 'ios';
  });
});
