import { Alert, Linking, Platform } from 'react-native';
import { haptics } from './haptics';

/**
 * A place to navigate to. Coordinates pin the exact spot; the address is the
 * geocode fallback and the label shown in the map app.
 */
export type MapTarget = {
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Tap-to-navigate dispatcher shared by the venue block and schedule stations.
 *
 * URL scheme matrix (verified against real devices — see CLAUDE.md):
 *
 *   Platform  |  Coords available            |  Address only
 *   ----------+-------------------------------+---------------------
 *   iOS       |  Alert: Apple Maps / GMaps    |  Same alert, geocoded
 *             |  `maps://?ll=lat,lng&q=label` |  `maps://?q=address`
 *             |  `comgooglemaps://?q=lat,lng` |  `comgooglemaps://?q=address`
 *   Android   |  `geo:lat,lng?q=lat,lng(lbl)` |  `geo:0,0?q=address`
 *
 * Never use `geo:lat,lng?q=address` — the `q=address` overrides the
 * coordinates and geocodes instead of pinning the exact spot. iOS falls back
 * to Apple Maps when Google Maps isn't installed.
 */
export function openLocationInMaps(target: MapTarget, t: (k: string) => string) {
  // Distinct from the lighter taps used elsewhere — signals "this hands off
  // to another app" before the alert/deep link even appears.
  haptics.impactMedium();
  const label = encodeURIComponent(target.name ?? target.address ?? '');
  const hasCoords = target.lat != null && target.lng != null;
  const { lat, lng } = target;

  const appleUrl = hasCoords
    ? `maps://?ll=${lat},${lng}&q=${label}`
    : `maps://?q=${encodeURIComponent(target.address ?? '')}`;
  const googleUrl = hasCoords
    ? `comgooglemaps://?q=${lat},${lng}&zoom=16`
    : `comgooglemaps://?q=${encodeURIComponent(target.address ?? '')}`;
  const androidUrl = hasCoords
    ? `geo:${lat},${lng}?q=${lat},${lng}(${label})`
    : `geo:0,0?q=${encodeURIComponent(target.address ?? '')}`;

  if (Platform.OS === 'ios') {
    Alert.alert(t('home.openInMaps'), t('home.openInMapsHint'), [
      { text: t('home.mapsApple'), onPress: () => Linking.openURL(appleUrl) },
      {
        text: t('home.mapsGoogle'),
        onPress: () => Linking.openURL(googleUrl).catch(() => Linking.openURL(appleUrl)),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  } else {
    Linking.openURL(androidUrl);
  }
}
