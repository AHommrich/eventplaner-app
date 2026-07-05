/**
 * Consent gate — Provider + `useConsentGate` hook.
 *
 * Callers use the hook inside their existing `onPress` handlers:
 *
 *     const { ensureConsent } = useConsentGate();
 *     async function handleUpload() {
 *       if (!(await ensureConsent('photo_upload'))) return;
 *       // ...existing code
 *     }
 *
 * Behaviour:
 *   - Consent already granted → resolves `true` immediately, no UI shown.
 *     The wrapped screen renders and behaves byte-identically to today.
 *   - Consent not granted → the Provider shows a bottom-sheet modal with
 *     purpose + revocation info + explicit "Ich stimme zu" tap. Grant →
 *     resolves `true`. Dismiss / decline → resolves `false` (the caller
 *     is expected to return early).
 *
 * One modal at a time — a second `ensureConsent` while a modal is already up
 * would produce a queued promise; today's screens never trigger that case, so
 * we keep the state simple.
 */
import { createContext, useContext, useState, ReactNode } from 'react';
import { View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { useLanguage } from '../lib/LanguageContext';
import { useEventTheme } from '../lib/EventThemeContext';
import { getConsent, grantConsent, ConsentKey } from '../lib/consents';
import { theme } from '../constants/theme';

type ContextValue = {
  ensureConsent: (purpose: ConsentKey) => Promise<boolean>;
};

const ConsentGateContext = createContext<ContextValue | null>(null);

type Pending = {
  purpose: ConsentKey;
  resolve: (granted: boolean) => void;
};

/** Locale-key shard per purpose (used to build `consents.<shard>.title/body`). */
const LOCALE_SHARD: Record<ConsentKey, string> = {
  photo_upload: 'photoUpload',
  photo_game: 'photoGame',
};

export function ConsentGateProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  async function ensureConsent(purpose: ConsentKey): Promise<boolean> {
    const existing = await getConsent(purpose);
    if (existing) return true;
    return new Promise<boolean>((resolve) => {
      setPending({ purpose, resolve });
    });
  }

  async function handleGrant() {
    if (!pending) return;
    await grantConsent(pending.purpose);
    pending.resolve(true);
    setPending(null);
  }

  function handleDecline() {
    pending?.resolve(false);
    setPending(null);
  }

  return (
    <ConsentGateContext.Provider value={{ ensureConsent }}>
      {children}
      {pending && (
        <ConsentModal purpose={pending.purpose} onGrant={handleGrant} onDecline={handleDecline} />
      )}
    </ConsentGateContext.Provider>
  );
}

/**
 * Consume the gate. Throws when used outside `ConsentGateProvider` so a
 * missing provider fails loudly at render, not silently at consent check.
 */
export function useConsentGate(): ContextValue {
  const c = useContext(ConsentGateContext);
  if (!c) throw new Error('useConsentGate must be used within ConsentGateProvider');
  return c;
}

/**
 * Bottom-sheet consent modal. Renders inside the Provider so it lives above
 * every screen without polluting the router tree.
 */
function ConsentModal({
  purpose,
  onGrant,
  onDecline,
}: {
  purpose: ConsentKey;
  onGrant: () => void;
  onDecline: () => void;
}) {
  const { t } = useLanguage();
  const { colors } = useEventTheme();
  const shard = LOCALE_SHARD[purpose];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDecline}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: theme.borderRadius.lg,
            borderTopRightRadius: theme.borderRadius.lg,
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
          }}
        >
          <ThemedText
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.cardText,
              marginBottom: theme.spacing.md,
            }}
          >
            {t(`consents.${shard}.title`)}
          </ThemedText>
          <ScrollView style={{ maxHeight: 300 }}>
            <ThemedText style={{ fontSize: 14, color: colors.cardText, lineHeight: 22 }}>
              {t(`consents.${shard}.body`)}
            </ThemedText>
          </ScrollView>
          <TouchableOpacity
            onPress={onGrant}
            style={{
              marginTop: theme.spacing.lg,
              backgroundColor: colors.cardButton,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              alignItems: 'center',
            }}
          >
            <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600', fontSize: 15 }}>
              {t('consents.grant')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDecline}
            style={{
              marginTop: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <ThemedText style={{ color: colors.cardText, fontSize: 14 }}>
              {t('consents.decline')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
