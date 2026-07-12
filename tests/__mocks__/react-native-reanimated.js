// Manual Jest mock for react-native-reanimated.
//
// The package's own `mock.js` (recommended by upstream docs) still imports
// its real `./index`, which pulls in `react-native-worklets`'s
// `NativeWorklets.native.js` — that file unconditionally instantiates the
// native turbo module at import time, before any web/Jest gate runs, and
// crashes outside a real app runtime. Rather than fight that resolution
// order, this mock reimplements the small surface this codebase actually
// uses: shared values resolve synchronously (no UI thread), timing/spring
// helpers complete immediately, and `entering`/`exiting`/`layout` props are
// accepted but inert since RNTL doesn't need to observe the animation itself.
const React = require('react');
const RN = require('react-native');

function useSharedValue(initial) {
  const [box] = React.useState(() => ({ value: initial }));
  return box;
}

function useAnimatedStyle(factory) {
  return factory();
}

function useAnimatedProps(factory) {
  return factory();
}

function runOnJS(fn) {
  return (...args) => fn(...args);
}

// react-native-gesture-handler's `GestureDetector` feature-detects Reanimated
// by requiring this module directly (not through the mock) and checking for
// `useSharedValue`/`useEvent`/`setGestureState`. Since our `useSharedValue`
// above makes that detection succeed, we need to satisfy the rest of the
// contract too — real gesture events never fire under RNTL, so a no-op is
// enough to keep `GestureDetector` from crashing on mount.
function useEvent() {
  return null;
}

function setGestureState() {}

function runOnUI(fn) {
  return (...args) => fn(...args);
}

function cancelAnimation() {}

function withTiming(toValue, _config, callback) {
  if (callback) callback(true);
  return toValue;
}

function withSpring(toValue, _config, callback) {
  if (callback) callback(true);
  return toValue;
}

function withDecay(_config, callback) {
  if (callback) callback(true);
  return 0;
}

function withRepeat(animation) {
  return animation;
}

function withSequence(...animations) {
  return animations[animations.length - 1];
}

function interpolate(value, input, output, extrapolate) {
  const clamp = extrapolate === 'clamp' || extrapolate?.extrapolateLeft === 'clamp';
  let i = 0;
  while (i < input.length - 2 && value > input[i + 1]) i++;
  const inputMin = input[i];
  const inputMax = input[i + 1];
  const outputMin = output[i];
  const outputMax = output[i + 1];
  const progress = inputMax === inputMin ? 0 : (value - inputMin) / (inputMax - inputMin);
  const result = outputMin + progress * (outputMax - outputMin);
  if (!clamp) return result;
  const [lo, hi] = outputMin < outputMax ? [outputMin, outputMax] : [outputMax, outputMin];
  return Math.min(hi, Math.max(lo, result));
}

const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' };

// `entering`/`exiting`/`layout` are consumed as plain props by the mocked
// `Animated.View` below and never invoked — the chainable `.duration()` API
// just needs to return an object so call sites like
// `FadeIn.duration(200)` don't throw.
function makeAnimationBuilder() {
  const builder = {
    duration: () => builder,
    delay: () => builder,
    springify: () => builder,
    damping: () => builder,
    stiffness: () => builder,
  };
  return builder;
}

const FadeIn = makeAnimationBuilder();
const FadeOut = makeAnimationBuilder();
const FadeInUp = makeAnimationBuilder();
const FadeOutUp = makeAnimationBuilder();
const LinearTransition = makeAnimationBuilder();

function createAnimatedComponent(Component) {
  return Component;
}

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  FlatList: RN.FlatList,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue: useSharedValue,
  runOnJS,
  runOnUI,
  useEvent,
  setGestureState,
  cancelAnimation,
  withTiming,
  withSpring,
  withDecay,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  ReduceMotion,
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeOutUp,
  LinearTransition,
  createAnimatedComponent,
  setUpTests: () => {},
};
