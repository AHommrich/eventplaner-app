import { Stack } from 'expo-router';
import '../global.css';
import { LanguageProvider } from '../lib/LanguageContext';
import { EventThemeProvider } from '../lib/EventThemeContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <EventThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="scan" />
          <Stack.Screen name="rsvp" />
          <Stack.Screen name="declined" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </EventThemeProvider>
    </LanguageProvider>
  );
}
