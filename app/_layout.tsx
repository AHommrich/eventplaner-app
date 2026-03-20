import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
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
import { Asset } from 'expo-asset';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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
    JosefinSans_400Regular,
    JosefinSans_700Bold,
  });

  useEffect(() => {
    Asset.loadAsync(require('../assets/house_party.jpg'));
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <LanguageProvider>
      <EventThemeProvider>
        <BlockedFeaturesProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="rsvp" />
            <Stack.Screen name="declined" />
            <Stack.Screen name="blocked" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </BlockedFeaturesProvider>
      </EventThemeProvider>
    </LanguageProvider>
  );
}
