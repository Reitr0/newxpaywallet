// src/features/dapps/ui/DappRow.jsx
import React from 'react';
import { View } from 'react-native';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VText from '@src/shared/ui/primitives/VText';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VImage from '@src/shared/ui/primitives/VImage';

export default function DappRow({ item, onPress }) {
  return (
    <VPressable onPress={() => onPress?.(item)}>
      <View className="flex-row items-center py-3">
        <VImage source={{ uri: item.icon }} className="w-12 h-12 rounded-xl mr-3" />
        <View className="flex-1">
          <VText className="text-base font-semibold text-title">{item.title}</VText>
          <VText numberOfLines={1} className="text-sm text-muted">{item.subtitle}</VText>
        </View>
        <VIcon name="chevron-right" size={18} className="text-muted" />
      </View>
    </VPressable>
  );
}
