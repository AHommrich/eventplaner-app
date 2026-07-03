// Test-run bootstrap. Every mock here substitutes an Expo/RN native module
// that either (a) requires a device runtime or (b) is only meaningful inside
// an Expo Router / Expo Go environment. All mocks are `jest.mock(...)` calls
// so they take effect BEFORE any importing module resolves.

// --- expo-secure-store ---
// Backing map lives on `globalThis` so a test can reach in and assert
// contents without exporting a private ref. Every write clears + re-sets.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  (globalThis as any).__secureStore = store;
  return {
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { store.delete(key); }),
  };
});

// --- expo-router ---
// The real router requires a mounted Stack. Mocked functions record calls so
// tests can assert `router.replace('/(tabs)/home')` was invoked without
// spinning up a navigator. `useFocusEffect` is routed through `useEffect`
// (deferred to mount) so the callback's `setState` never fires during render.
jest.mock('expo-router', () => {
  const React = require('react');
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    dismiss: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  return {
    router,
    useRouter: () => router,
    useSegments: () => [],
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), []);
    },
    Stack: ({ children }: any) => children,
    Tabs: Object.assign(({ children }: any) => children, {
      Screen: () => null,
    }),
  };
});

// --- expo-image-picker ---
// Every launcher returns a "not canceled + single fixture asset" by default
// so happy-path tests don't have to opt in per call. Tests that need the
// cancel branch override with `mockResolvedValueOnce({ canceled: true })`.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/fixture-camera.jpg', mimeType: 'image/jpeg' }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/fixture-library.jpg', mimeType: 'image/jpeg' }],
  })),
}));

// --- expo-camera ---
// `CameraView` renders as a plain `<View>` in tests; the `onBarcodeScanned`
// callback is exposed on the fake so tests can trigger a scan manually.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: any) => React.createElement(View, props),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

// --- expo-linking ---
// Records every `openURL` call so tests can assert the platform-specific
// map URL that `openInMaps` picked without hitting the OS.
jest.mock('expo-linking', () => ({
  openURL: jest.fn(async () => true),
  canOpenURL: jest.fn(async () => true),
}));

// --- expo-localization ---
// A stable `de-DE` device locale keeps the language auto-detection branch
// deterministic; tests that exercise the `needsLanguagePick` fallback
// override this per suite.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'de', regionCode: 'DE' }],
}));

// --- expo-image-manipulator ---
// Passthrough — we don't care about the resize/compress arithmetic in unit
// tests, only that the caller receives a `uri` to upload.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string) => ({ uri })),
  SaveFormat: { JPEG: 'jpeg' },
}));

// --- expo-file-system/legacy ---
// The gallery-QR flow reads the picked image as base64. A tiny stub keeps the
// interface intact without touching the real filesystem.
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(async () => 'AAA='),
}));

// --- nativewind ---
// Nativewind's Babel transform runs at build time; in tests we stub the
// runtime hook so components importing `useColorScheme` (transitively) don't
// crash.
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light', setColorScheme: jest.fn() }),
}));

// --- expo-linear-gradient ---
// Renders as a plain `View` so snapshot / query behaviour matches the
// production tree structurally without the gradient renderer.
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: any) => React.createElement(View, props) };
});

// --- expo-image ---
// Same shape as `expo-linear-gradient`: the native image renderer is stubbed
// to a plain `<View>` so any screen that renders remote thumbnails mounts in
// tests without a real image pipeline.
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: any) => React.createElement(View, props) };
});

// --- expo-font ---
// Fonts are always "loaded" in tests so `_layout.tsx` doesn't stall waiting
// for `useFonts` to resolve. `@expo/vector-icons` calls `Font.isLoaded` /
// `Font.loadAsync` at module load, so we stub the full surface it touches.
jest.mock('expo-font', () => ({
  useFonts: () => [true],
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(async () => {}),
  processFontFamily: (name: string) => name,
}));

// --- expo-splash-screen ---
// No-op both APIs — they touch native code that Jest can't reach.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
