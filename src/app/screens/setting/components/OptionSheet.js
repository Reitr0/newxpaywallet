import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

function OptionSheet({ title, items, selected, onSelect, sheetRef }) {
  const onPick = useCallback(
    (key) => {
      onSelect?.(key);
      sheetRef.current?.dismiss?.();
    },
    [onSelect, sheetRef]
  );

  const keyExtractor = useCallback((it) => String(it.key), []);
  const selectedKey = String(selected);

  const renderItem = useCallback(
    ({ item }) => {
      const active = String(item.key) === selectedKey;
      return (
        <VPressable
          onPress={() => onPick(item.key)}
          className={`flex-row items-center px-3 py-3 rounded-xl mx-2 mb-2 ${
            active ? 'bg-item' : 'bg-surface'
          }`}
        >
          <VText className="flex-1 text-base">{item.label}</VText>
          {active ? (
            <VIcon type="Feather" name="check" size={18} className="text-link" />
          ) : null}
        </VPressable>
      );
    },
    [onPick, selectedKey]
  );

  // Optional: help FlatList estimate sizes
  const getItemLayout = useCallback(
    (_data, index) => ({ length: 56, offset: 56 * index, index }), // ~ px-3 py-3 row ≈ 56px
    []
  );

  // Snap points as percent + compact second point
  const snapPoints = useMemo(() => ['70%', '90%'], []);

  return (
    <VBottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      initialIndex={0}
      enablePanDownToClose
      indicatorColor="#2C3746"
    >
      <View className="flex-1 h-96">
        <View className="px-4 pt-4 pb-3">
          <VText className="text-lg font-semibold">{title}</VText>
        </View>

        <BottomSheetFlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={20}
          windowSize={10}
          showVerticalScrollIndicator={false}
        />
      </View>
    </VBottomSheet>
  );
}

export default OptionSheet;
