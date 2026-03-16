import { Stack } from 'expo-router';
import '../global.css';
import { LanguageProvider } from '../lib/LanguageContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </LanguageProvider>
  );
}
