import React from 'react';
import { View } from 'react-native';

/**
 * Thin horizontal line used between list items.
 */
export default function VItemSeparator({ className = '' }) {
  return (
    <View className={['h-[0.5px] bg-border-subtle', className].join(' ')} />
  );
}
