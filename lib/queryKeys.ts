/**
 * Centralized, scope-aware query keys (Checkpoint 2).
 *
 * Every account-specific key embeds the non-secret `QueryScope` (actor + id +
 * sessionId) so the cache can never serve one account's or event's data to
 * another, and a logout/switch (new scope) naturally invalidates all reads.
 * Never key on a bearer token or any secret.
 */
import type { QueryScope } from './sessionCache';

type ScopeKey = readonly [actor: string, id: number, sessionId: string];

function scopeKey(scope: QueryScope | null): ScopeKey {
  if (!scope) return ['anon', 0, ''];
  if (scope.actor === 'guest') return ['guest', scope.guestId, scope.sessionId];
  return ['management', scope.eventId, scope.sessionId];
}

export const qk = {
  photos: (scope: QueryScope | null) => ['photos', ...scopeKey(scope)] as const,
  eventInfo: (scope: QueryScope | null) => ['eventInfo', ...scopeKey(scope)] as const,
  guestMe: (scope: QueryScope | null) => ['guestMe', ...scopeKey(scope)] as const,
  photoGameStatus: (scope: QueryScope | null) => ['photoGameStatus', ...scopeKey(scope)] as const,
  hiddenGuests: (scope: QueryScope | null) => ['hiddenGuests', ...scopeKey(scope)] as const,
  drinksCatalog: (scope: QueryScope | null) => ['drinksCatalog', ...scopeKey(scope)] as const,
  drinksStats: (scope: QueryScope | null) => ['drinksStats', ...scopeKey(scope)] as const,
  managementEvents: (scope: QueryScope | null) => ['managementEvents', ...scopeKey(scope)] as const,
  notes: (scope: QueryScope | null) => ['notes', ...scopeKey(scope)] as const,
  managementPhotos: (scope: QueryScope | null) => ['managementPhotos', ...scopeKey(scope)] as const,
  managementSchedule: (scope: QueryScope | null) =>
    ['managementSchedule', ...scopeKey(scope)] as const,
} as const;
