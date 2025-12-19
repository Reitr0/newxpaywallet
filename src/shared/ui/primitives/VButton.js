// src/components/common/VButton.js
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import clsx from 'clsx';

/**
 * VButton
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'danger'|'outline'} props.variant
 * @param {string} props.title
 * @param {function} props.onPress
 * @param {string} [props.className] - extra tailwind classes
 * @param {string} [props.textClassName] - extra tailwind classes for text
 * @param {string} [props.accessibilityLabel]
 */
export default function VButton({
                                  variant = 'primary',
                                  title,
                                  onPress,
                                  className = '',
                                  textClassName = '',
                                  accessibilityLabel,
                                }) {
  const bgBase = {
    primary: 'bg-btn-primary-bg',
    secondary: 'bg-btn-secondary-bg',
    danger: 'bg-btn-danger-bg',
    outline: 'bg-btn-outline-bg border border-btn-outline-border',
  };

  const bgPressed = {
    primary: 'bg-btn-primary-press',
    secondary: 'bg-btn-secondary-press',
    danger: 'bg-btn-danger-press',
    outline: 'bg-btn-outline-press',
  };

  const textBase = {
    primary: 'text-btn-primary-text',
    secondary: 'text-btn-secondary-text',
    danger: 'text-btn-danger-text',
    outline: 'text-btn-outline-text',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          className={clsx(
            'rounded-full items-center py-4',
            pressed ? bgPressed[variant] : bgBase[variant],
            className
          )}
        >
          <Text
            className={clsx(
              'font-bold text-lg',
              textBase[variant],
              textClassName
            )}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
