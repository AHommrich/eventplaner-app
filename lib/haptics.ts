/**
 * Thin wrapper around expo-haptics. Every call is fire-and-forget (callers
 * never await) and swallows errors — haptics are a nice-to-have feel layer,
 * never something that should surface an error or block an action.
 */
import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function fire(action: () => Promise<void>): void {
  if (!enabled) return;
  void action().catch(() => {});
}

export const haptics = {
  success(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  impactLight(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  impactMedium(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  selection(): void {
    fire(() => Haptics.selectionAsync());
  },
};
