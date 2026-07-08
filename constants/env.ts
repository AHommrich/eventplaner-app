/**
 * API base URL that every axios call in `lib/api.ts` inherits.
 *
 * Resolved at build time from `EXPO_PUBLIC_API_BASE` so a single codebase can
 * ship against staging or production without a source edit. Expo Go and EAS
 * Preview use the staging default (`beta.hommrich.app`); the EAS production
 * profile injects `https://eveplan.de`. Guest tokens are NOT interchangeable
 * between the two backends, so a build pointed at the wrong backend fails at
 * QR login instead of silently crossing environments.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://beta.hommrich.app';
