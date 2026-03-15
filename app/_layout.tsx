import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { getSession } from '../lib/auth';
import '../global.css';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session) {
        router.replace('/home');
      } else {
        router.replace('/');
      }
    })();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="home" />
    </Stack>
  );
}
