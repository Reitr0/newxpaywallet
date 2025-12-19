// src/shared/ui/primitives/VSnackbar.js
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, } from 'react-native-reanimated';
import VText from './VText';
import clsx from 'clsx';

const SHOW_MS = 200;
const HIDE_MS = 200;
const AUTO_DISMISS_MS = 3000;

export default function VSnackbar({ visible, message, type = 'info', onHide }) {
  // mount control so the view unmounts after hide anim
  const [mounted, setMounted] = useState(visible);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (visible) {
      // ensure mounted, then animate in
      if (!mounted) setMounted(true);
      opacity.value = withTiming(1, { duration: SHOW_MS, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: SHOW_MS, easing: Easing.out(Easing.ease) });

      // auto-dismiss
      const t = setTimeout(() => onHide?.(), AUTO_DISMISS_MS);
      return () => clearTimeout(t);
    } else if (mounted) {
      // animate out, then unmount
      opacity.value = withTiming(0, { duration: HIDE_MS, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(setMounted)(false);
      });
      translateY.value = withTiming(30, { duration: HIDE_MS, easing: Easing.in(Easing.ease) });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  return (
    // Let touches pass through outside the bar
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-8 items-center">
      <Animated.View
        pointerEvents="auto"
        style={animatedStyle}
        className={clsx(
          'rounded-xl px-4 py-3 shadow-md max-w-[92%]',
          'items-center self-center',
          type === 'success' && 'bg-success',
          type === 'error' && 'bg-danger',
          type === 'info' && 'bg-link'
        )}
      >
        <VText className="text-inverse text-center font-medium">{message}</VText>
      </Animated.View>
    </View>
  );
}
