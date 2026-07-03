/**
 * API base URL that every axios call in `lib/api.ts` inherits.
 *
 * Resolved at build time from `EXPO_PUBLIC_API_BASE` so a single codebase can
 * ship against staging or production without a source edit. Staging is the
 * safe default because guest tokens are NOT interchangeable between the two
 * backends — a production build accidentally pointed at staging would 401 on
 * every QR scan. Flipping to production is a deliberate release action.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://beta.hommrich.app';
