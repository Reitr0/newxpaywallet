// src/components/VFlatList.js
import React, { memo, useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

/**
 * VFlatList
 * - Great defaults for performance
 * - Optional separator, empty component, keyExtractor fallback
 * - Supports NativeWind `className` and `contentContainerClassName`
 */
function VFlatListBase({
                         data,
                         renderItem,
                         keyExtractor,
                         className,
                         contentContainerClassName,
                         ItemSeparatorComponent,
                         ListEmptyComponent,
                         estimatedItemSize, // optional: if you know average item height
                         initialNumToRender = 10,
                         maxToRenderPerBatch = 10,
                         windowSize = 10,
                         updateCellsBatchingPeriod = 50,
                         removeClippedSubviews = true,
                         showsVerticalScrollIndicator = false,
                         showsHorizontalScrollIndicator = false,
                         horizontal = false,
                         onEndReachedThreshold = 0.5,
                         onEndReached,
                         ...rest
                       }) {
  const defaultKeyExtractor = useMemo(
    () =>
      keyExtractor ||
      ((item, index) =>
        item?.id != null ? String(item.id) : String(index)),
    [keyExtractor]
  );

  const Separator =
    ItemSeparatorComponent ||
    (() => <View className={horizontal ? 'w-2' : 'h-2'} />);

  const Empty =
    ListEmptyComponent ||
    (() => (
      <View className="py-6 items-center">
        <Text className="text-muted text-sm">
          No items available
        </Text>
      </View>
    ));

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={defaultKeyExtractor}
      className={className}
      contentContainerClassName={contentContainerClassName}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={Empty}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      updateCellsBatchingPeriod={updateCellsBatchingPeriod}
      removeClippedSubviews={removeClippedSubviews}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      horizontal={horizontal}
      onEndReachedThreshold={onEndReachedThreshold}
      onEndReached={onEndReached}
      getItemLayout={
        estimatedItemSize
          ? (_, index) => ({
            length: estimatedItemSize,
            offset: estimatedItemSize * index,
            index,
          })
          : undefined
      }
      {...rest}
    />
  );
}

const VFlatList = memo(VFlatListBase);
export default VFlatList;
