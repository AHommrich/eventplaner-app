// Runs after the test framework is installed (so `beforeEach` exists), unlike
// `tests/setup.ts` which only registers module mocks.
//
// The session cache (`lib/sessionCache.ts`) is a module singleton: its
// in-memory token/scope values persist across tests within a worker. Reset it
// — and the SecureStore mock map — before every test so a value written by one
// test cannot leak into the next. Mirrors a fresh app launch.
import { _resetForTests as resetSessionCache } from '../lib/sessionCache';

beforeEach(() => {
  (globalThis as { __secureStore?: Map<string, string> }).__secureStore?.clear();
  resetSessionCache();
  // Clear the shared `queryClient` singleton (EventThemeProvider uses it
  // directly) so cached theme/event data can't leak between tests. Lazy
  // `require` — a static import here would load `lib/api` before a test file's
  // `jest.mock('axios')` factory registers, breaking those suites.
  try {
    const { queryClient } = require('../lib/queryClient');
    queryClient.clear();
    // Retries off in tests: otherwise a rejected query retries with backoff and
    // an error-state assertion times out (CP2 test-infra requirement).
    queryClient.setDefaultOptions({ queries: { retry: false } });
  } catch {
    // queryClient not resolvable in this suite's mock graph — nothing to clear.
  }
});
