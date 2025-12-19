// src/features/dapps/ui/confirm/DappConfirmSheet.jsx
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import { BottomSheetView } from '@gorhom/bottom-sheet';

const TitleByVariant = {
  connect: 'Connect to site',
  sign: 'Sign message',
  tx: 'Send transaction',
  switch: 'Switch network',
  custom: 'Confirm',
};

const ColorByVariant = {
  connect: 'text-blue-600',
  sign: 'text-amber-600',
  tx: 'text-emerald-600',
  switch: 'text-purple-600',
  custom: 'text-title',
};

const DappConfirmSheet = forwardRef(function DappConfirmSheet(_props, ref) {
  const sheetRef = useRef(null);
  const [payload, setPayload] = useState(null); // { title, message, options, onApprove, onReject }

  const close = useCallback(() => {
    sheetRef.current?.dismiss?.();
    // defer clear to allow close animation
    setTimeout(() => setPayload(null), 200);
  }, []);

  const present = useCallback((p) => {
    setPayload(p);
    // open after state set
    setTimeout(() => sheetRef.current?.present?.(), 0);
  }, []);

  useImperativeHandle(ref, () => ({
    present,
    close,
  }), [present, close]);

  const onApprove = useCallback(() => {
    try { payload?.onApprove?.(); } finally { close(); }
  }, [payload, close]);

  const onReject = useCallback(() => {
    try { payload?.onReject?.(); } finally { close(); }
  }, [payload, close]);

  const title = payload?.title || TitleByVariant[payload?.options?.variant || 'custom'];
  const color = ColorByVariant[payload?.options?.variant || 'custom'];

  return (
    <VBottomSheet
      ref={sheetRef}
      snapPoints={['40%', '75%']}
      initialIndex={0}
      enablePanDownToClose
      indicatorColor="#2C3746"
      onClose={close}
    >
      <BottomSheetView>
        <View className={'flex-1'}>
          <View className="px-4 py-3">
            <VText className={`text-base font-semibold ${color}`}>{title}</VText>
          </View>

          <ScrollView className="px-4">
            {!!payload?.message && (
              <VText className="text-title/80 text-sm leading-5">{payload.message}</VText>
            )}

            {/* optional extra content (e.g., tx preview / typed data summary) */}
            {payload?.options?.extra}
          </ScrollView>

          <View className="px-4 pb-5 pt-3 flex-row justify-between">
            <VPressable
              onPress={onReject}
              className="flex-1 h-10 mr-2 rounded-xl border border-border-subtle items-center justify-center"
            >
              <VText className="text-title">{payload?.options?.cancelText || 'Cancel'}</VText>
            </VPressable>

            <VPressable
              onPress={onApprove}
              className="flex-1 h-10 ml-2 rounded-xl bg-blue-600 items-center justify-center"
            >
              <VText className="text-white font-semibold">{payload?.options?.confirmText || 'Approve'}</VText>
            </VPressable>
          </View>
        </View>
      </BottomSheetView>
    </VBottomSheet>
  );
});

export default DappConfirmSheet;
