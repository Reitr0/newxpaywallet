import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VBack from '@src/shared/ui/primitives/VBack';
import VImage from '@src/shared/ui/primitives/VImage';
import RemoveAccountSheet from '@src/app/screens/setting/components/RemoveAccountSheet';
import db from '@src/shared/infra/db/db';
import { authStore } from '@features/auth/state/authStore';


export default function AccountScreen({ navigation }) {
  const { t } = useTranslation();
  const sheetRef = useRef(null);

  const onRequirePin = () => {
    navigation.navigate('AppLockScreen', {
      mode: 'enter',
      showHeader: true,
      onCallBack: () => {
        navigation.navigate('ExportMnemonicScreen');
      },
    });
  };


  const handleRemoveAccount = async () => {
    await db.clearAll();
    await authStore.clearAuth()
  };
  const onOpenRemoveSheet = () => {
    // Just like DappConfirmSheet — pass the onConfirm callback
    sheetRef.current?.present({
      onConfirm: handleRemoveAccount,
    });
  };
  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="w-full h-8 px-2">
        <VBack />
      </View>

      {/* Avatar */}
      <View className="items-center mt-4 mb-6">
        <VImage
          source={require('@assets/images/logo.png')}
          className="w-24 h-24 rounded-full mb-3 bg-item dark:bg-item"
        />
      </View>

      {/* Account Actions */}
      <View className="rounded-2xl my-4 flex-1">
        <VPressable
          className="flex-row items-center px-4 py-3 active:opacity-70"
          onPress={() => onRequirePin('viewRecovery')}
        >
          <VIcon name="key" type="Feather" size={20} className="mr-3 text-foreground/80" />
          <VText className="flex-1 text-base">
            {t('account.viewRecovery', 'View recovery phrase')}
          </VText>
          <VIcon name="chevron-right" type="Feather" size={18} className="text-muted" />
        </VPressable>
      </View>

      {/* Remove Account Button */}
      <View className="px-4 mt-6">
        <VPressable
          onPress={onOpenRemoveSheet}
          className="flex-row items-center justify-center px-4 py-4 rounded-2xl bg-btn-danger-bg active:opacity-80"
        >
          <VIcon name="trash-2" type="Feather" size={20} className="text-btn-danger-text mr-2" />
          <VText className="text-btn-danger-text font-semibold text-base">
            {t('account.remove', 'Remove account')}
          </VText>
        </VPressable>
      </View>
      <RemoveAccountSheet ref={sheetRef} />
    </View>
  );
}
