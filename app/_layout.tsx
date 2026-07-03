/**
 * Root layout — mounts the three global providers, the animated splash and
 * the router stack.
 *
 * Provider ordering matters and is deliberate:
 *
 *   1. `LanguageProvider` (outermost) — every downstream provider might call
 *      `t()`, e.g. for an error message. Sits at the top so no consumer
 *      reads the context before it's ready.
 *   2. `EventThemeProvider` — needs a session before it fetches, which is
 *      only meaningful once the language layer above has resolved.
 *   3. `BlockedFeaturesProvider` — depends on the axios instance from
 *      `lib/api.ts`; wraps only the router stack so it can register/detach
 *      cleanly.
 *
 * The splash screen is an in-app overlay on top of the router stack (NOT the
 * native launch screen) so we can cross-fade it out AFTER fonts + auto-detect
 * finished. The native splash is dismissed early via
 * `SplashScreen.hideAsync()` — the animated overlay then fades from opacity
 * 1 → 0 over 500 ms after a 1.5 s brand hold.
 *
 * All 8 configured wedding fonts are loaded up front so
 * `EventThemeContext` can flip to any of them without a second fetch cycle.
 * Adding a font here MUST be matched by an entry in `constants/fonts.ts` or
 * `ThemedText` will silently fall back to system font.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Cinzel_400Regular,
  Cinzel_700Bold,
} from '@expo-google-fonts/cinzel';
import {
  DancingScript_400Regular,
  DancingScript_700Bold,
} from '@expo-google-fonts/dancing-script';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';
import { Nunito_700Bold } from '@expo-google-fonts/nunito';
import {
  Raleway_400Regular,
  Raleway_700Bold,
} from '@expo-google-fonts/raleway';
import {
  Lora_400Regular,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
  JosefinSans_400Regular,
  JosefinSans_700Bold,
} from '@expo-google-fonts/josefin-sans';
import '../global.css';
import { LanguageProvider } from '../lib/LanguageContext';
import { EventThemeProvider } from '../lib/EventThemeContext';
import { BlockedFeaturesProvider } from '../lib/BlockedFeaturesContext';
import { ConsentGateProvider } from '../components/ConsentGate';

SplashScreen.preventAutoHideAsync();

// Splash gradient — hand-picked to match the eveplan brand identity. Never
// resolves through the dynamic theme because splash renders BEFORE the theme
// provider has fetched its palette.
const SPLASH_COLORS = ['#FF6B8A', '#FF8C5A', '#FFD166', '#72D4C8'] as const;

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_700Bold,
    Cinzel_400Regular,
    Cinzel_700Bold,
    DancingScript_400Regular,
    DancingScript_700Bold,
    GreatVibes_400Regular,
    Raleway_400Regular,
    Raleway_700Bold,
    Lora_400Regular,
    Lora_700Bold,
    Comfortaa_700Bold,
    Nunito_700Bold,
    JosefinSans_400Regular,
    JosefinSans_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    SplashScreen.hideAsync();
    // 1.5 s brand hold, then a 500 ms cross-fade to the router content —
    // long enough for the guest to see the logo, short enough not to feel
    // like a startup delay.
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setSplashVisible(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  return (
    <LanguageProvider>
      <EventThemeProvider>
        <BlockedFeaturesProvider>
          <ConsentGateProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="rsvp" />
            <Stack.Screen name="declined" />
            <Stack.Screen name="blocked" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="legal/privacy" />
            <Stack.Screen name="consents/index" />
            <Stack.Screen name="data-export" />
            <Stack.Screen name="erasure-pending" />
          </Stack>
          {splashVisible && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="none">
              <LinearGradient
                colors={SPLASH_COLORS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.splashLogoWrap}>
                <Image
                  source={require('../assets/eve-logo.png')}
                  style={styles.splashLogo}
                  resizeMode="contain"
                />
                <Text style={styles.splashTagline}>eveplan</Text>
              </View>
            </Animated.View>
          )}
          </ConsentGateProvider>
        </BlockedFeaturesProvider>
      </EventThemeProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  splashLogoWrap: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  splashLogo: {
    width: 420,
    height: 200,
  },
  splashTagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: -60,
  },
});
