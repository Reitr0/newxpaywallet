// src/components/VSearchBar.js
import React from 'react';
import { TextInput, View } from 'react-native';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VPressable from '@src/shared/ui/primitives/VPressable';

export default function VSearchBar({
                                     value,
                                     onChangeText,
                                     placeholder = 'Search tokens or chains',
                                     onClear,
                                   }) {
  const showClear = value?.length > 0;

  return (
    <View className="flex-1 flex-row items-center bg-elevated rounded-2xl px-3 border border-border-subtle shadow-sm">
      {/* Left icon */}
      <VIcon
        name="magnify"
        type="MaterialCommunityIcons"
        size={20}
        className="text-muted mr-2"
      />

      {/* Text input */}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        className="flex-1 text-base text-title"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search tokens"
        returnKeyType="search"
      />

      {/* Clear button */}
      {showClear && (
        <VPressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          className="rounded-full active:bg-item"
        >
          <VIcon
            name="close-circle"
            type="MaterialCommunityIcons"
            size={20}
            className="text-muted"
          />
        </VPressable>
      )}
    </View>
  );
}
