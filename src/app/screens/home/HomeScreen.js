// src/pages/home/ui/HomeScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import { RefreshControl, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import { walletStore } from '@features/wallet/state/walletStore';

import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import VListEmpty from '@src/shared/ui/molecules/VListEmpty';
import Fiat from '@src/shared/ui/atoms/Fiat';
import { RowWallet } from '@src/app/screens/wallet/components/RowItem';
import useWallet from '@src/app/screens/wallet/hooks/useWallet';
import Percent from '@src/shared/ui/atoms/Percent';
import VImage from '@src/shared/ui/primitives/VImage';

function QuickAction({ icon, label, active, onPress }) {
  const base =
    'w-16 h-16 mx-3 rounded-2xl items-center justify-center ' +
    (active ? 'bg-link' : 'bg-item');
  const iconClass = active ? 'text-inverse' : 'text-title';
  const textClass = 'mt-2 text-center text-title';

  return (
    <VPressable
      className="items-center active:opacity-70"
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={base}>
        <VIcon
          name={icon}
          type="MaterialCommunityIcons"
          size={24}
          className={iconClass}
        />
      </View>
      <VText className={textClass}>{label}</VText>
    </VPressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { portfolio } = useSnapshot(walletStore);
  const [tab, setTab] = useState('crypto');
  const { list: wallets, totalUsd, refresh, refreshing } = useWallet();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUp = (portfolio?.changeUsd24h ?? 0) >= 0;

  // localized labels (memoized to avoid re-renders)
  const labels = useMemo(
    () => ({
      send: t('home.actions.send', 'Send'),
      receive: t('home.actions.receive', 'Receive'),
      fund: t('home.actions.fund', 'Fund'),
      sell: t('home.actions.sell', 'Sell'),
      cryptoTab: t('home.tabs.crypto', 'Crypto'),
      nftsTab: t('home.tabs.nfts', 'NFTs'),
      manageCrypto: t('home.actions.manageCrypto', 'Manage'),
      refreshing: t('home.refreshing', 'Refreshing…'),
    }),
    [t]
  );

  const onRowPress = (item) => {
    navigation.navigate('WalletDetailScreen', { assetId: item.id });
  };

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center justify-between px-2">
        <View className="flex-row items-center gap-3">
          <VImage
            source={require('@assets/images/logo.png')}
            className={'w-9 h-9 bg-item rounded-full'}
          />
        </View>
      </View>

      {/* Balance */}
      <View className="items-center mt-2">
        <Fiat value={totalUsd} className="text-[45px] leading-[45px] font-extrabold" />
        <VText className={isUp ? 'text-up mt-1' : 'text-down mt-1'}>
          <Fiat value={portfolio.changeUsd24h} />{' '}
          <VText className={'text-muted'}>(</VText>
          <Percent value={portfolio.changePct24h} />
          <VText className={'text-muted'}>)</VText>
        </VText>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-center px-6 mt-5">
        <QuickAction
          icon="arrow-top-right"
          label={labels.send}
          onPress={() => navigation.navigate('WalletsScreen', { action: 'SEND' })}
        />
        <QuickAction
          icon="arrow-bottom-left"
          label={labels.receive}
          onPress={() => navigation.navigate('WalletsScreen', { action: 'RECEIVE' })}
        />
        <QuickAction
          icon="lightning-bolt"
          label={labels.fund}
          active
          onPress={() => navigation.navigate('WalletsScreen', { action: 'BUY' })}
        />
        <QuickAction
          icon="bank-outline"
          label={labels.sell}
          onPress={() => navigation.navigate('WalletsScreen', { action: 'SELL' })}
        />
      </View>

      {/* Tabs */}
      <View className="flex-row gap-8 px-4 mt-8">
        <VPressable onPress={() => setTab('crypto')} accessibilityRole="tab">
          <VText className="text-title text-lg font-semibold">{labels.cryptoTab}</VText>
          {tab === 'crypto' ? (
            <View className="h-1 rounded-full bg-title mt-2" />
          ) : (
            <View className="h-1 mt-2" />
          )}
        </VPressable>
        <VPressable onPress={() => setTab('nfts')} accessibilityRole="tab">
          <VText className="text-title text-lg font-semibold">{labels.nftsTab}</VText>
          {tab === 'nfts' ? (
            <View className="h-1 rounded-full bg-title mt-2" />
          ) : (
            <View className="h-1 mt-2" />
          )}
        </VPressable>
        <View className="flex-1" />
        <VPressable
          className="p-2 rounded-lg active:bg-item"
          accessibilityRole="button"
          onPress={() => {
            navigation.navigate('ManageCrypto');
          }}
          accessibilityLabel={labels.manageCrypto}
        >
          <VIcon
            name="tune-variant"
            type="MaterialCommunityIcons"
            size={20}
            className="text-title"
          />
        </VPressable>
      </View>

      {/* Wallet list */}
      <View className="flex-1 px-4 mt-2">
        <VFlatList
          data={tab === 'crypto' ? wallets : []}
          estimatedItemSize={76}
          keyExtractor={(it) => it.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#888"
              title={refreshing ? labels.refreshing : ''}
              progressViewOffset={8}
            />
          }
          renderItem={({ item }) => (
            <RowWallet
              item={item}
              onPress={onRowPress}
            />
          )}
          ItemSeparatorComponent={VItemSeparator}
          ListEmptyComponent={VListEmpty}
        />
      </View>
    </View>
  );
}
