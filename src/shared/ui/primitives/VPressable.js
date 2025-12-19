// src/components/VPressable.js
import React from 'react';
import { Platform, Pressable, View } from 'react-native';

/**
 * VPressable
 * - Base styles on the Pressable (ensures hit area)
 * - pressedClassName is toggled while pressed
 * - Optional Android ripple
 */
export default function VPressable({
                                     children,
                                     className = '',
                                     pressedClassName = '',
                                     disabled = false,
                                     onPress,
                                     androidRipple = { color: 'rgba(0,0,0,0.08)', borderless: false },
                                     hitSlop = { top: 6, bottom: 6, left: 6, right: 6 },
                                     accessibilityRole = 'button',
                                     accessibilityLabel,
                                     ...rest
                                   }) {
  return (
    <Pressable
      className={className}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      android_ripple={Platform.OS === 'android' ? androidRipple : undefined}
      {...rest}
    >
      {({ pressed }) => (
        // Keep children as-is; just toggle an extra class on the wrapper element
        <React.Fragment>
          {/* We rely on tailwind's "pressedClassName" being applied via parent Pressable state */}
          <PressableInner pressed={pressed} pressedClassName={pressedClassName}>
            {children}
          </PressableInner>
        </React.Fragment>
      )}
    </Pressable>
  );
}

function PressableInner({ pressed, pressedClassName, children }) {
  // If no pressedClassName is provided, render children directly (no extra View)
  if (!pressedClassName) return children;
  // Otherwise add a wrapper that only toggles pressed style (doesn't change layout)
  return (
    <View // NativeWind will turn this into a View on RN; or replace with View if you prefer
      className={pressed ? pressedClassName : ''}
    >
      {children}
    </View>
  );
}
