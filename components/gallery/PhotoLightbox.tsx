/*
 * This is the guest lightbox's reanimated pattern moved verbatim into a shared
 * component (the guest screen is the source of truth and passes lint with the
 * exact same shared-value mutations). The React-Compiler rules flag mutating
 * `dragY.value`/`entryOpacity.value` and the initial-photo sync here but not in
 * the identical guest code — an inconsistent false positive for reanimated
 * shared values, which are mutable by design.
 */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  FlatList as GestureFlatList,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GalleryPhotoItem, ZoomableGalleryImage } from './GalleryPrimitives';
import { haptics } from '../../lib/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DETAIL_ITEM_W = SCREEN_W;
const DETAIL_SNAP = SCREEN_W;
const DETAIL_PEEK = 0;

/**
 * The single shared photo detail viewer used by both the guest gallery and the
 * organizer gallery. Owns the scrim, swipe-to-dismiss pan gesture, horizontal
 * zoomable pager, close button and entry/exit animation — the guest experience
 * is the source of truth. Screen-specific actions (report/hide vs. delete) come
 * in through `renderFooter`; nothing else differs between the two callers.
 */
export function PhotoLightbox<T extends GalleryPhotoItem>({
  visible,
  photos,
  initialPhotoId,
  onClose,
  onPhotoChange,
  gestureEnabled = true,
  closeLabel,
  renderFooter,
}: {
  visible: boolean;
  photos: T[];
  initialPhotoId: number | null;
  onClose: () => void;
  onPhotoChange?: (photo: T) => void;
  gestureEnabled?: boolean;
  closeLabel?: string;
  renderFooter?: (photo: T) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<number | null>(initialPhotoId);
  const dragY = useSharedValue(0);
  const entryOpacity = useSharedValue(0);

  const rootAnimatedStyle = useAnimatedStyle(() => ({ opacity: entryOpacity.value }));
  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [-300, 0, 300], [0, 1, 0], Extrapolation.CLAMP),
  }));
  const photoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: interpolate(dragY.value, [-300, 0, 300], [0.88, 1, 0.88], Extrapolation.CLAMP) },
    ],
  }));

  useEffect(() => {
    setActiveId(initialPhotoId);
  }, [initialPhotoId]);

  useEffect(() => {
    if (visible) entryOpacity.value = withTiming(1, { duration: 120 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = useCallback(() => {
    cancelAnimation(dragY);
    cancelAnimation(entryOpacity);
    dragY.value = 0;
    entryOpacity.value = 0;
    onClose();
  }, [dragY, entryOpacity, onClose]);

  const handleClosePress = useCallback(() => {
    entryOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(close)();
    });
  }, [entryOpacity, close]);

  const nativeListGesture = useMemo(() => Gesture.Native(), []);
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(gestureEnabled)
        .activeOffsetY([-12, 12])
        .failOffsetX([-15, 15])
        .simultaneousWithExternalGesture(nativeListGesture)
        .onUpdate((e) => {
          dragY.value = e.translationY;
        })
        .onEnd((e) => {
          const flickDown = e.velocityY > 1200 || e.translationY > 120;
          const flickUp = e.velocityY < -1200 || e.translationY < -80;
          if (flickDown || flickUp) {
            const target = flickDown ? SCREEN_H : -SCREEN_H;
            runOnJS(haptics.impactLight)();
            dragY.value = withTiming(target, { duration: 220 }, (finished) => {
              if (finished) runOnJS(close)();
            });
          } else {
            dragY.value = withSpring(0, { damping: 14, stiffness: 120 });
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gestureEnabled]
  );

  const activePhoto = photos.find((p) => p.id === activeId) ?? null;
  const activeIndex = Math.max(
    0,
    photos.findIndex((p) => p.id === activeId)
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClosePress}
      statusBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, rootAnimatedStyle]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,0,0,0.25)' },
            scrimAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        <GestureDetector gesture={panGesture}>
          <View style={StyleSheet.absoluteFillObject}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                { justifyContent: 'center' },
                photoAnimatedStyle,
              ]}
            >
              {activePhoto && (
                <GestureDetector gesture={nativeListGesture}>
                  <GestureFlatList
                    testID="photo-detail-pager"
                    data={photos}
                    horizontal
                    pagingEnabled
                    initialScrollIndex={activeIndex}
                    getItemLayout={(_, index) => ({
                      length: DETAIL_ITEM_W,
                      offset: DETAIL_SNAP * index,
                      index,
                    })}
                    keyExtractor={(item) => String(item.id)}
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const raw = event.nativeEvent.contentOffset.x;
                      const nextIndex = Math.max(
                        0,
                        Math.min(Math.round((raw + DETAIL_PEEK) / DETAIL_SNAP), photos.length - 1)
                      );
                      const next = photos[nextIndex];
                      if (next && next.id !== activeId) {
                        setActiveId(next.id);
                        onPhotoChange?.(next);
                      }
                    }}
                    onScrollToIndexFailed={() => undefined}
                    renderItem={({ item }) => (
                      <ZoomableGalleryImage uri={item.url} width={DETAIL_ITEM_W} />
                    )}
                    style={{ width: SCREEN_W, height: SCREEN_H * 0.8, flexGrow: 0 }}
                  />
                </GestureDetector>
              )}
            </Animated.View>

            <Pressable
              onPress={handleClosePress}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={{ position: 'absolute', top: insets.top + 12, right: 20 }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>

            {activePhoto && renderFooter && (
              <View
                style={{
                  position: 'absolute',
                  bottom: insets.bottom + 28,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {renderFooter(activePhoto)}
              </View>
            )}
          </View>
        </GestureDetector>
      </Animated.View>
    </Modal>
  );
}
