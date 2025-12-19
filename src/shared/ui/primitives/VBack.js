// src/components/VBack.js
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VText from '@src/shared/ui/primitives/VText';

export default function VBack({
                                label = 'Back',
                                icon = 'arrow-left',
                                className = '',
                                onPress,
                                showLabel = false,
                              }) {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) onPress();
    else navigation.goBack();
  };

  return (
    <VPressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={[
        'px-2 w-12 rounded-lg active:bg-btn-secondary-press',
        className,
      ].join(' ')}
    >
      <VIcon
        type="MaterialCommunityIcons"
        name={icon}
        size={24}
        className="text-title"
      />
      {showLabel && (
        <VText variant="body" className="ml-2 text-title">
          {label}
        </VText>
      )}
    </VPressable>
  );
}
