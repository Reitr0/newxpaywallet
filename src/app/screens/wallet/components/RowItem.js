import VPressable from '@src/shared/ui/primitives/VPressable';
import { View } from 'react-native';
import TokenIcon from '@src/shared/ui/primitives/VTokenIcon';
import VNetworkBadge from '@src/shared/ui/primitives/VNetworkBadge';
import VText from '@src/shared/ui/primitives/VText';
import Fiat from '@src/shared/ui/atoms/Fiat';
import Percent from '@src/shared/ui/atoms/Percent';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';
import React from 'react';

export function RowWallet({ item, isActive, onPress }) {
  const symbol = item.symbol;
  const tag = item.tag;
  const price = Number.isFinite(item.price) ? item.price : 0;
  const change = Number.isFinite(item.priceChangePercent) ? item.priceChangePercent : 0;
  const balNum = Number(item?.balance ?? 0);
  return (
    <VPressable
      onPress={() => onPress?.(item)}
      className={[
        'flex-row items-center py-3',
        isActive ? 'bg-item/60 rounded-lg' : '',
      ].join(' ')}
      accessibilityRole="button"
      accessibilityHint="Set active wallet"
    >
      {/* If you have per-chain logos, you can map them here. Fallback is a plain circle. */}
      <View className="w-12 h-9 rounded-full bg-item mr-3 items-center justify-center">
        <TokenIcon tokenKey={item.id} />
        <VNetworkBadge source={{uri: item.networkLogoUrl}} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <VText className="text-title text-base font-semibold mr-2">{symbol}</VText>
          <View className="px-2 py-0.5 rounded-full bg-item">
            <VText className="text-xs text-muted">{tag}</VText>
          </View>
        </View>
        <View className="flex-row items-center mt-0.5">
          <Fiat value={price} className="text-title mr-2" />
          <Percent value={change} className="text-sm" />
        </View>
      </View>
      <View className="items-end w-48">
        <CryptoAmount amount={   Number.isFinite(balNum) ? balNum : 0} symbol={symbol} className="text-title" />
        <Fiat value={(price > 0 && Number.isFinite(balNum)) ? (balNum * price) : 0} className="text-muted" />
      </View>
    </VPressable>
  );
}
