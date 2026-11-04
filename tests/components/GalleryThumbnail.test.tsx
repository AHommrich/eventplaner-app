import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { GalleryThumbnail } from '../../components/gallery/GalleryPrimitives';

const photo = { id: 7, url: 'https://example.test/7.jpg' };

describe('components/gallery/GalleryThumbnail', () => {
  it('opens the photo while the image loads fine', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <GalleryThumbnail
        photo={photo}
        size={100}
        radius={8}
        onPress={onPress}
        unavailableLabel="Unavailable"
      />
    );

    fireEvent.press(getByTestId('photo-7'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('turns into a non-pressable placeholder when the image fails to load', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId, getByLabelText, UNSAFE_getByType } = render(
      <GalleryThumbnail
        photo={photo}
        size={100}
        radius={8}
        onPress={onPress}
        unavailableLabel="Unavailable"
      />
    );

    fireEvent(UNSAFE_getByType(Image), 'error', { error: 'not found' });

    expect(queryByTestId('photo-7')).toBeNull();
    expect(getByTestId('photo-7-unavailable')).toBeTruthy();
    expect(getByLabelText('Unavailable')).toBeTruthy();
    // Host view without a press handler (fireEvent.press would bubble to the
    // composite's own onPress prop, so assert on the rendered element instead).
    expect(getByTestId('photo-7-unavailable').props.onPress).toBeUndefined();
    expect(onPress).not.toHaveBeenCalled();
  });
});
