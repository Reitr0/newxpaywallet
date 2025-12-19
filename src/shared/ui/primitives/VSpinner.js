// src/shared/ui/primitives/VSpinner.js
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, } from 'react-native-reanimated';
import { useEffect } from 'react';

/**
 * VSpinner
 * NativeWind-styled custom rotating loader.
 *
 * Props:
 *  - size: number (default 20)
 *  - thickness: number (default 3)
 *  - className: string (NativeWind classes, default border-link)
 */
export default function VSpinner({
                                   size = 20,
                                   thickness = 3,
                                   className = 'border-link',
                                 }) {
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));


  return (
    <Animated.View
      className={[
        'rounded-full border-t-transparent',
        className, // you can pass "border-inverse", "border-muted", etc.
      ].join(' ')}
      style={[
        {
          width: size,
          height: size,
          borderWidth: thickness,
        },
        spinStyle,
      ]}
    />
  );
}
