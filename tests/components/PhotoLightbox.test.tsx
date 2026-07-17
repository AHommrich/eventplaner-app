import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});

import { PhotoLightbox } from '../../components/gallery/PhotoLightbox';

const photos = [
  { id: 1, url: 'https://example.test/1.jpg' },
  { id: 2, url: 'https://example.test/2.jpg' },
];

describe('components/gallery/PhotoLightbox', () => {
  it('renders the pager and a screen-specific footer for the active photo', () => {
    const { getByTestId, getByText } = render(
      <PhotoLightbox
        visible
        photos={photos}
        initialPhotoId={1}
        onClose={jest.fn()}
        closeLabel="Close"
        renderFooter={(photo) => <Text>{`footer-${photo.id}`}</Text>}
      />
    );

    expect(getByTestId('photo-detail-pager')).toBeTruthy();
    expect(getByText('footer-1')).toBeTruthy();
  });

  it('invokes onClose when the close control is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <PhotoLightbox
        visible
        photos={photos}
        initialPhotoId={1}
        onClose={onClose}
        closeLabel="Close"
        renderFooter={() => null}
      />
    );

    fireEvent.press(getByLabelText('Close'));
    // Exit animation resolves onClose via the mocked reanimated timing.
    expect(onClose).toHaveBeenCalled();
  });

  it('reports the new photo when the pager scrolls to it', () => {
    const onPhotoChange = jest.fn();
    const { getByTestId } = render(
      <PhotoLightbox
        visible
        photos={photos}
        initialPhotoId={1}
        onClose={jest.fn()}
        onPhotoChange={onPhotoChange}
        renderFooter={() => null}
      />
    );

    const { width } = require('react-native').Dimensions.get('window');
    fireEvent(getByTestId('photo-detail-pager'), 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: width },
        contentSize: { width: width * 2, height: 0 },
        layoutMeasurement: { width, height: 0 },
      },
    });

    expect(onPhotoChange).toHaveBeenCalledWith(photos[1]);
  });

  it('renders nothing interactive when not visible', () => {
    const { queryByTestId } = render(
      <PhotoLightbox
        visible={false}
        photos={photos}
        initialPhotoId={null}
        onClose={jest.fn()}
        renderFooter={() => null}
      />
    );

    expect(queryByTestId('photo-detail-pager')).toBeNull();
  });
});
