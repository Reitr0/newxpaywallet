// src/shared/ui/sheets/VBottomSheet.js
import React, { forwardRef, useImperativeHandle, useMemo, useRef, } from 'react';

import { BottomSheetModal, } from '@gorhom/bottom-sheet';
import { View } from 'react-native';
import clsx from 'clsx';

const ThemedSheetBackground = forwardRef(({ isDark, ...props }, ref) => (
  <View
    ref={ref}
    className={clsx(
      isDark ? 'bg-card' : 'bg-elevated'
    )}
    {...props}
  />
));

/**
 * VBottomSheet
 * Wrapper around BottomSheetModal with built-in providers.
 *
 * Usage:
 *   const ref = useRef(null);
 *   <VBottomSheet ref={ref}>
 *     <YourContent />
 *   </VBottomSheet>
 *   ...
 *   ref.current?.present();
 */
const VBottomSheet = forwardRef(
  (
    {
      snapPoints: snapPointsProp = ['45%'],
      initialIndex = 0,
      backgroundColor = 'transparent',
      indicatorColor = '#666',
      enablePanDownToClose = true,
      onChange,
      children,
      contentClassName = 'flex-1',
    },
    ref
  ) => {
    const modalRef = useRef(null);
    const snapPoints = useMemo(() => snapPointsProp, [snapPointsProp]);

    useImperativeHandle(ref, () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
    }));

    return (
      <BottomSheetModal
        ref={modalRef}
        index={initialIndex}
        snapPoints={snapPoints}
        enablePanDownToClose={enablePanDownToClose}
        backgroundComponent={ThemedSheetBackground}
        handleIndicatorStyle={{ backgroundColor: indicatorColor }}
        onChange={onChange}
      >
        {children}
      </BottomSheetModal>
    );
  }
);

export default VBottomSheet;
