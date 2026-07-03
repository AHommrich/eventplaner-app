/**
 * `lib/consents` — Art. 6/7 (a) explicit consent persistence.
 */
import * as SecureStore from 'expo-secure-store';
import {
  getConsent,
  grantConsent,
  revokeConsent,
  ALL_PURPOSES,
} from '../../lib/consents';

describe('lib/consents', () => {
  beforeEach(async () => {
    for (const p of ALL_PURPOSES) {
      await SecureStore.deleteItemAsync('consent_' + p);
    }
  });

  it('returns null when no consent has ever been granted', async () => {
    expect(await getConsent('photo_upload')).toBeNull();
  });

  it('grantConsent persists a record with an ISO timestamp', async () => {
    await grantConsent('photo_upload');
    const record = await getConsent('photo_upload');
    expect(record).not.toBeNull();
    // Loose ISO check — YYYY-MM-DDTHH:MM…
    expect(record!.granted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('grant + revoke round-trip removes the record entirely', async () => {
    await grantConsent('photo_upload');
    expect(await getConsent('photo_upload')).not.toBeNull();
    await revokeConsent('photo_upload');
    expect(await getConsent('photo_upload')).toBeNull();
  });

  it('per-purpose isolation: granting one does not grant the other', async () => {
    await grantConsent('photo_upload');
    expect(await getConsent('photo_upload')).not.toBeNull();
    expect(await getConsent('photo_game')).toBeNull();
  });

  it('re-granting overwrites the timestamp (last grant wins)', async () => {
    await grantConsent('photo_upload');
    const first = await getConsent('photo_upload');
    // Force a distinct millisecond so the second grant produces a new stamp.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await grantConsent('photo_upload');
    const second = await getConsent('photo_upload');
    expect(second!.granted_at).not.toBe(first!.granted_at);
  });

  it('corrupted secure-store entry is treated as absent', async () => {
    await SecureStore.setItemAsync('consent_photo_upload', '{not valid json');
    expect(await getConsent('photo_upload')).toBeNull();
  });

  it('ALL_PURPOSES lists every ConsentKey', () => {
    expect(ALL_PURPOSES).toEqual(expect.arrayContaining(['photo_upload', 'photo_game']));
    expect(ALL_PURPOSES.length).toBe(2);
  });
});
