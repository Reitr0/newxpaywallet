import React from 'react';
import { StyleSheet, View } from 'react-native';
import VImage from '@src/shared/ui/primitives/VImage';

export default function VNetworkBadge({
                                        source,
                                        size = 16,
                                        className = '',
                                        style,
                                      }) {

  return (
    <View
      className={['absolute items-center justify-center rounded-full', className].join(' ')}
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          right: -3,
          bottom: -8,
        },
        style,
      ]}
    >
      <VImage source={source} style={[styles.image, { borderRadius: size / 2 }]} />
    </View>
  );
}

// --- Styles -----------------------------------------------------
const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderColor: '#0025FF',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  }
});
