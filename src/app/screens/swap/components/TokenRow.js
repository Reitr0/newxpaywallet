// src/features/swap/ui/TokenRow.js
import React from 'react';
import { View } from 'react-native';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VText from '@src/shared/ui/primitives/VText';
import Fiat from '@src/shared/ui/atoms/Fiat';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';
import TokenIcon from '@src/shared/ui/primitives/VTokenIcon';

export default function TokenRow({ item, onPress }) {
  return (
    <VPressable
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      className="flex-row items-center py-3"
    >
      <TokenIcon tokenKey={item.id} className="w-9 h-9 rounded-full mr-3" />
      <View className="flex-1">
        <View className="flex-row items-center">
          <VText className="text-title font-semibold mr-2">{item.symbol}</VText>
          <View className="px-2 py-0.5 rounded-full bg-item border border-border-subtle">
            <VText className="text-2xs text-muted">{item.chain}</VText>
          </View>
        </View>
        <VText className="text-muted text-xs" numberOfLines={1}>{item.name}</VText>
      </View>

      <View className="items-end">
        <VText className="text-title">
          <CryptoAmount amount={item.balanceNum} decimals={0} symbol={item.symbol} />
        </VText>
        <VText className="text-muted text-xs">
          <Fiat value={item.usdValue} />
        </VText>
      </View>
    </VPressable>
  );
}
