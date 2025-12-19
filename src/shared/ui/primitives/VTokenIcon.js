// src/components/TokenIcon.js
import React from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { tokenIconStore } from '@features/tokens/icon/state/tokenIconStore';
import VText from '@src/shared/ui/primitives/VText';
import VImage from '@src/shared/ui/primitives/VImage';

export default function TokenIcon({ tokenKey, symbol, className = 'w-12 h-12 rounded-full' }) {
  const snap = useSnapshot(tokenIconStore);

  const iconSource = snap.icons[tokenKey] || snap.icons.fallback;

  if (iconSource?.uri || typeof iconSource === 'number') {
    return (
      <VImage
        source={iconSource}
        className={className}
        resizeMode="contain"
      />
    );
  }
  // fallback to initials
  return (
    <View
      className="rounded-full bg-item items-center justify-center w-12 h-12"
    >
      <VText className="text-title font-semibold">
        {(symbol || '?').slice(0, 3).toUpperCase()}
      </VText>
    </View>
  );
}
