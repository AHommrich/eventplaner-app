import { useEffect } from 'react';
import { Stack } from 'expo-router';
import '../global.css';
import { LanguageProvider } from '../lib/LanguageContext';
import { EventThemeProvider } from '../lib/EventThemeContext';
import { Asset } from 'expo-asset';

export default function RootLayout() {
  useEffect(() => {
    Asset.loadAsync(require('../assets/house_party.jpg'));
  }, []);

  return (
    <LanguageProvider>
      <EventThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="scan" />
          <Stack.Screen name="rsvp" />
          <Stack.Screen name="declined" />
          <Stack.Screen name="blocked" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </EventThemeProvider>
    </LanguageProvider>
  );
}
