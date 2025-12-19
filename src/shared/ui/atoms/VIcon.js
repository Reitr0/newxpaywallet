// src/components/VIcon.js
import React from 'react';
import { cssInterop } from 'nativewind';

// Import the sets you actually use to keep bundle smaller
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';

// Enable className → style for each icon set
cssInterop(MaterialCommunityIcons, { className: 'style' });
cssInterop(Ionicons, { className: 'style' });
cssInterop(Feather, { className: 'style' });

const ICON_SETS = {
  MaterialCommunityIcons,
  Ionicons,
  Feather,
};

/**
 * VIcon
 * - Wrapper around react-native-vector-icons with NativeWind v4 className support
 * - `type` selects icon set
 */
export default function VIcon({
                                type = 'MaterialCommunityIcons',
                                name,
                                size = 20,
                                color,            // optional; if omitted, color can come from Tailwind via className (e.g. text-link)
                                className,
                                style,
                                accessible = true,
                                accessibilityRole = 'image',
                                accessibilityLabel,
                                ...rest
                              }) {
  const IconSet = ICON_SETS[type];
  const Comp = IconSet || MaterialCommunityIcons;
  return (
    <Comp
      name={name}
      size={size}
      color={color}
      className={className}
      style={style}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || name}
      {...rest}
    />
  );
}
