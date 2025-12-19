import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import VIcon from '@src/shared/ui/atoms/VIcon';

const RemoveAccountSheet = forwardRef(function RemoveAccountSheet(_props, ref) {
  const { t } = useTranslation();
  const sheetRef = useRef(null);
  const [payload, setPayload] = useState(null); // { onConfirm }

  const close = useCallback(() => {
    sheetRef.current?.dismiss?.();
    setTimeout(() => setPayload(null), 200);
  }, []);

  const present = useCallback((p) => {
    setPayload(p);
    setTimeout(() => sheetRef.current?.present?.(), 0);
  }, []);

  useImperativeHandle(ref, () => ({ present, close }), [present, close]);

  const onConfirm = useCallback(() => {
    try {
      payload?.onConfirm?.();
    } finally {
      close();
    }
  }, [payload, close]);

  return (
    <VBottomSheet
      ref={sheetRef}
      snapPoints={['35%']}
      initialIndex={0}
      enablePanDownToClose
      indicatorColor="#2C3746"
      onClose={close}
    >
      <BottomSheetView>
        <View className="flex-1 px-4 pt-4 pb-6">
          {/* Title */}
          <VText className="text-lg font-semibold text-error mb-1">
            {t('account.removeTitle', 'Remove account')}
          </VText>

          <VText className="text-title/80 text-sm leading-5 mb-4">
            {t(
              'account.removeConfirm',
              'This will remove your account from the app. Make sure you have backed up your recovery phrase.'
            )}{' '}
            {t('account.cannotUndo', 'This action cannot be undone.')}
          </VText>

          {/* Warning */}
          <View className="flex-row items-center px-3 py-2 mb-5 bg-error/10 rounded-xl">
            <VIcon
              name="alert-triangle"
              type="Feather"
              size={18}
              className="text-error mr-2"
            />
            <VText className="text-error text-sm">
              {t('account.removeLoseAccess', "You’ll lose access to this wallet.")}
            </VText>
          </View>

          {/* Buttons */}
          <View className="flex-row">
            <VPressable
              onPress={close}
              className="flex-1 h-10 mr-2 rounded-xl border border-border-subtle items-center justify-center"
            >
              <VText className="text-title">{t('common.cancel', 'Cancel')}</VText>
            </VPressable>

            <VPressable
              onPress={onConfirm}
              className="flex-1 h-10 ml-2 rounded-xl bg-btn-danger-bg items-center justify-center active:opacity-80"
            >
              <VText className="text-white font-semibold">
                {t('account.remove', 'Remove')}
              </VText>
            </VPressable>
          </View>
        </View>
      </BottomSheetView>
    </VBottomSheet>
  );
});

export default RemoveAccountSheet;
