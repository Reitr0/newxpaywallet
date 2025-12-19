import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

/**
 * VSwitch (NativeWind)
 * - Fully stylable size via props
 * - Animated thumb slide + track color
 * - Defaults match your screenshot (blue on, gray off)
 *
 * Props:
 *  - value: boolean
 *  - onValueChange: (next:boolean)=>void
 *  - disabled?: boolean
 *  - width?: number  (default 48)
 *  - height?: number (default 28)
 *  - activeColor?: string  (default '#0025FF')
 *  - inactiveColor?: string (default '#C7C7CC')
 *  - thumbColor?: string (default '#FFFFFF')
 */
export default function VSwitch({
                                  value = false,
                                  onValueChange,
                                  disabled = false,
                                  width = 48,
                                  height = 28,
                                  activeColor = '#0025FF',
                                  inactiveColor = '#C7C7CC',
                                  thumbColor = '#FFFFFF',
                                }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  // sizing
  const trackRadius = height / 2;
  const thumbSize = Math.round(height * 0.64);
  const pad = (height - thumbSize) / 2;

  // animations
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });
  const tx = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [pad, width - thumbSize - pad],
  });

  const toggle = () => {
    if (disabled) return;
    onValueChange?.(!value);
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      className="justify-center"
      style={{ width, height }}
    >
      {/* Track */}
        <Animated.View
          className="rounded-full"
          style={{
            width,
            height,
            borderRadius: trackRadius,
            backgroundColor: bg,
          }}
        >
          {/* Thumb */}
          <Animated.View
            className="absolute rounded-full shadow-sm"
            style={{
              top: pad,
              width: thumbSize,
              height: thumbSize,
              transform: [{ translateX: tx }],
              backgroundColor: thumbColor,
            }}
          />
        </Animated.View>
    </Pressable>
  );
}
