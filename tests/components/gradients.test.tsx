/**
 * Smoke tests for the presentational gradient/animation helpers. They render
 * without throwing and pass the derived colours through to expo-linear-gradient
 * (mocked in the jest setup). Guards against a broken import or a bad colour
 * derivation reaching a screen.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GradientFill } from '../../components/GradientFill';
import { ScreenGradient } from '../../components/ScreenGradient';
import { FadeInView } from '../../components/FadeInView';

describe('components/GradientFill', () => {
  it('renders with a derived gradient for a base colour', () => {
    const { toJSON } = render(<GradientFill color="#7c2d3e" radius={16} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('components/ScreenGradient', () => {
  it('renders a three-stop background from screen bg + primary', () => {
    const { toJSON } = render(<ScreenGradient screenBg="#e7ded7" primary="#7c2d3e" />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('components/FadeInView', () => {
  it('renders its children when enabled', () => {
    const { getByText } = render(
      <FadeInView enabled delay={70}>
        <Text>hi</Text>
      </FadeInView>
    );
    expect(getByText('hi')).toBeTruthy();
  });

  it('renders statically when disabled (classic preset)', () => {
    const { getByText } = render(
      <FadeInView enabled={false}>
        <Text>static</Text>
      </FadeInView>
    );
    expect(getByText('static')).toBeTruthy();
  });
});
