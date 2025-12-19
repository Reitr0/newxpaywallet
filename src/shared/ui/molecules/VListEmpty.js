import React from 'react';
import { View } from 'react-native';
import VText from '@src/shared/ui/primitives/VText';

/**
 * Standard "empty list" placeholder message.
 */
export default function VListEmpty({ message = 'No items yet.', className = '' }) {
  return (
    <View className={['py-8 items-center', className].join(' ')}>
      <VText className="text-muted">{message}</VText>
    </View>
  );
}
