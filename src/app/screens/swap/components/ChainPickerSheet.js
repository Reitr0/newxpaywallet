// src/features/swap/ui/ChainPickerSheet.js
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import VPressable from '@src/shared/ui/primitives/VPressable';
import { networkStore } from '@features/network/state/networkStore';
import VImage from '@src/shared/ui/primitives/VImage';

const CHAINS = [
  { key: 'ethereum', label: 'Ethereum', icon: 'ethereum' },
  { key: 'bsc', label: 'BNB Smart Chain', icon: 'currency-btc' },
  { key: 'polygon', label: 'Polygon', icon: 'hexagon-outline' }
];

const ChainPickerSheet = forwardRef(({ onSelect }, ref) => {

  return (
    <VBottomSheet ref={ref} snapPoints={['60%','60%']} initialIndex={1}>
      <View className="px-4 py-2">
        <VText className="text-title font-semibold text-base mb-3">Select Network</VText>
        <BottomSheetFlatList
          data={CHAINS}
          keyExtractor={(it) => it.key}
          ItemSeparatorComponent={VItemSeparator}
          estimatedItemSize={76}
          renderItem={({ item }) => {
            const networkConfig = networkStore.getConfig(item.key);
            return (
              <VPressable
                onPress={() => {
                  onSelect?.(item.key);
                  ref.current?.dismiss();
                }}
                className="flex-row items-center py-3"
              >
                <VImage source={{uri: networkConfig.logoUrl}} className="w-8 h-8 mr-3 border rounded-full" />
                <VText className="text-title text-sm">{item.label}</VText>
              </VPressable>
            )
          }}
        />
      </View>
    </VBottomSheet>
  )
});

export default ChainPickerSheet;
