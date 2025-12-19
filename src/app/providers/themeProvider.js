// src/theme/ThemeProvider.js
import React from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { themeSchema } from '@src/shared/style/themeSchema';
import { useSnapshot } from 'valtio';
import { appearanceStore } from '@features/settings/appearance/state/appearanceStore';

const themes = {
  default: {
    light: vars(themeSchema.light),
    dark: vars(themeSchema.dark),
  },
};

export default function ThemeProvider({ name = 'default', children }) {
  const { colorScheme } = useSnapshot(appearanceStore); // 'light' | 'dark' | 'system'
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  return (
    <View style={themes[name][mode]} className="flex-1">
      {children}
    </View>
  );
}
