import * as Haptics from 'expo-haptics';
import { haptics, setHapticsEnabled } from '../../lib/haptics';

describe('lib/haptics', () => {
  afterEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });

  it('fires a success notification', () => {
    haptics.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  it('fires a warning notification', () => {
    haptics.warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning
    );
  });

  it('fires an error notification', () => {
    haptics.error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
  });

  it('fires a light impact', () => {
    haptics.impactLight();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('fires a medium impact', () => {
    haptics.impactMedium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('fires a selection tick', () => {
    haptics.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    setHapticsEnabled(false);
    haptics.success();
    haptics.impactLight();
    haptics.selection();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('swallows rejected promises', async () => {
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    expect(() => haptics.success()).not.toThrow();
    await Promise.resolve();
  });
});
