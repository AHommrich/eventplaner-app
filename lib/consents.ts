/**
 * Explicit consent persistence.
 *
 * Each `ConsentKey` corresponds to a distinct GDPR/DSGVO processing purpose
 * (Art. 6 (1) (a)). Consents are stored in `expo-secure-store` with a
 * `granted_at` ISO timestamp — the timestamp is the Art. 7 burden-of-proof
 * artefact ("when did the guest agree?"). Missing key = never granted.
 *
 * Revocation deletes the key entirely (Art. 7 (3): withdrawal must be as
 * easy as granting). No historical trail is kept on-device — that would
 * turn the consent record itself into a personal-data timeline.
 */
import * as SecureStore from 'expo-secure-store';

/** Every purpose the app asks explicit consent for. */
export type ConsentKey = 'photo_upload' | 'photo_game';

/** Persisted shape. `granted_at` is the audit-trail anchor. */
export type ConsentRecord = {
  granted_at: string;
};

const CONSENT_KEY_PREFIX = 'consent_';

/**
 * Read the consent record for a purpose.
 * @returns null when the guest has never granted (or has since revoked).
 */
export async function getConsent(purpose: ConsentKey): Promise<ConsentRecord | null> {
  const raw = await SecureStore.getItemAsync(CONSENT_KEY_PREFIX + purpose);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConsentRecord;
  } catch {
    // Corrupted entry — treat as absent so the next grant overwrites cleanly.
    return null;
  }
}

/** Grant consent — stamps the current time and persists. */
export async function grantConsent(purpose: ConsentKey): Promise<void> {
  const record: ConsentRecord = { granted_at: new Date().toISOString() };
  await SecureStore.setItemAsync(CONSENT_KEY_PREFIX + purpose, JSON.stringify(record));
}

/** Revoke — removes the record entirely; the next request re-asks. */
export async function revokeConsent(purpose: ConsentKey): Promise<void> {
  await SecureStore.deleteItemAsync(CONSENT_KEY_PREFIX + purpose);
}

/**
 * Enumeration of every consent purpose the app knows about. Consumed by the
 * management screen so a new purpose only needs an addition here + a
 * matching pair of locale strings.
 */
export const ALL_PURPOSES: ConsentKey[] = ['photo_upload', 'photo_game'];
