// src/pages/home/ui/HomeScreen.js
import React, { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import VListEmpty from '@src/shared/ui/molecules/VListEmpty';
import useWallet from '@src/app/screens/wallet/hooks/useWallet';
import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import { useTranslation } from 'react-i18next';
import WalletPickRow from '@src/app/screens/wallet/components/WalletPickRow';

export default function WalletsScreen({ navigation, route }) {
  const { action } = route.params;
  const { list: wallets, refresh, refreshing } = useWallet();
  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item }) => (
      <WalletPickRow item={item} action={action} navigation={navigation} />
    ),
    [action, navigation]
  );

  return (
    <View className="flex-1 bg-app">
      <View className="flex-row items-center px-2">
        <VBack />
        <View className="flex-1 items-center">
          <VText className="text-title font-semibold text-base">
            {t('wallets.selectYourAssets', 'Select')}
          </VText>
        </View>
        <View className="w-10" />
      </View>

      <View className="flex-1 px-4 mt-2">
        <VFlatList
          data={wallets}
          estimatedItemSize={76}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ItemSeparatorComponent={VItemSeparator}
          ListEmptyComponent={VListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#888"
              title={refreshing ? 'Refreshing…' : ''}
              progressViewOffset={8}
            />
          }
        />
      </View>
    </View>
  );
}
