// src/shared/ui/sheets/VBottomSheet.js
import React, { forwardRef, useImperativeHandle, useMemo, useRef, } from 'react';

import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
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
      // When true, render children directly (e.g. when child is BottomSheetScrollView/FlatList).
      // BottomSheetScrollView must be a direct child of BottomSheetModal to scroll properly.
      scrollable = false,
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
        enableDynamicSizing={false}
        enablePanDownToClose={enablePanDownToClose}
        backgroundComponent={ThemedSheetBackground}
        handleIndicatorStyle={{ backgroundColor: indicatorColor }}
        onChange={onChange}
      >
        {scrollable ? (
          children
        ) : (
          <BottomSheetView style={{ flex: 1 }}>
            {children}
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  }
);

export default VBottomSheet;
