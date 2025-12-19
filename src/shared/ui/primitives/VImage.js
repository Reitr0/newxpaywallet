import React from 'react';
import FastImage from 'react-native-fast-image';
import { SvgUri } from 'react-native-svg';
import { cssInterop } from 'nativewind';
import { View } from 'react-native';

// Enable Tailwind className on FastImage
cssInterop(FastImage, { className: 'style' });

function normalizeSource(source, cache) {
  if (!source) return undefined;

  if (typeof source === 'number') return source;
  if (typeof source === 'string') return { uri: source, cache };
  if (typeof source === 'object' && source.uri) return { ...source, cache };
  return source;
}

function isSvgSource(src) {
  if (!src) return false;
  const uri = typeof src === 'string' ? src : src.uri;
  return !!uri && (uri.endsWith('.svg') || uri.startsWith('data:image/svg+xml'));
}

/**
 * VImage
 * Supports:
 * - raster (FastImage)
 * - vector (SvgUri)
 * Works with Tailwind + style sizing for both.
 */
export default function VImage({
                                 className,
                                 style,
                                 source,
                                 cache = FastImage.cacheControl.immutable,
                                 resizeMode = FastImage.resizeMode.cover,
                                 accessible = true,
                                 accessibilityRole = 'image',
                                 width = '100%',
                                 height = '100%',
                                 ...rest
                               }) {
  const finalSource = normalizeSource(source, cache);

  if (isSvgSource(finalSource)) {
    const uri = typeof finalSource === 'string' ? finalSource : finalSource.uri;

    return (
      <View className={className} style={style}>
        <SvgUri
          uri={uri}
          width={typeof width === 'number' ? width : '100%'}
          height={typeof height === 'number' ? height : '100%'}
          preserveAspectRatio="xMidYMid meet"
          {...rest}
        />
      </View>
    );
  }

  return (
    <FastImage
      className={className}
      style={style}
      source={finalSource}
      resizeMode={resizeMode}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      {...rest}
    />
  );
}
