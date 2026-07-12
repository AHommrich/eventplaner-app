/**
 * Small floating toast that appears at the top of a screen after a
 * pull-to-refresh completes.
 *
 * Rendered by every tab that uses `useRefreshToast()`. The `visible` prop is
 * driven by the hook's `refreshed` flag — the toast fades in for ~2 s once
 * the spinner has closed and then fades back out. The `refreshing` prop is
 * intentionally accepted (see `Props`) but unused so callers can pass it
 * symmetrically alongside `visible`; if a spinner-in-toast variant is ever
 * wanted, this is where it would land.
 *
 * Chrome and positioning live in the shared `Toast` primitive; this
 * component only supplies the "✓ Refreshed" content.
 */
import { ThemedText } from './ThemedText';
import { useEventTheme } from '../lib/EventThemeContext';
import { useLanguage } from '../lib/LanguageContext';
import { Toast } from './ui/Toast';

type Props = {
  visible: boolean;
  /** Reserved for a future spinner-in-toast variant — currently unused. */
  refreshing: boolean;
};

export function RefreshToast({ visible }: Props) {
  const { colors } = useEventTheme();
  const { t } = useLanguage();

  return (
    <Toast visible={visible}>
      <ThemedText style={{ color: colors.cardButtonText, fontSize: 14, fontWeight: '700' }}>
        ✓ {t('common.refreshed')}
      </ThemedText>
    </Toast>
  );
}
