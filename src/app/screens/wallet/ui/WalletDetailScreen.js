// src/pages/asset/ui/AssetDetailScreen.js
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { appearanceStore } from '@features/settings/appearance/state/appearanceStore';
import { RowWallet } from '@src/app/screens/wallet/components/RowItem';
import useWallet from '@src/app/screens/wallet/hooks/useWallet';
import ChartWebView from '@src/app/screens/wallet/components/ChartWebView';
import useTransfi from '@src/app/screens/wallet/hooks/useTransfi';
import { HistoryTab } from '@src/app/screens/wallet/components/HistoryTab';

function Action({ icon, label, onPress }) {
  return (
    <VPressable onPress={onPress} className="items-center flex-1 py-2" accessibilityRole="button">
      <View className="h-12 w-14 rounded-xl bg-title items-center justify-center">
        <VIcon type="Ionicons" name={icon} size={18} className="text-inverse" />
      </View>
      <VText className="text-2xs text-title mt-1">{label}</VText>
    </VPressable>
  );
}

export default function WalletDetailScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { colorScheme } = useSnapshot(appearanceStore);
  const { assetId } = route.params;
  const { asset } = useWallet(assetId);

  const [tab, setTab] = useState('holdings'); // holdings | history | about

  const symbol = asset?.symbol || '';
  const tag = asset?.tag || '';
  const pair = symbol === 'USDT' ? `${symbol}DAI` : `${symbol}USDT`;

  // TransFi hook
  const { canOpen, openBuy, openSell } = useTransfi({
    asset,
    navigation,
    country: 'VN',
    fiatTicker: 'VND',
  });

  const TABS = useMemo(
    () => ({
      holdings: t('asset.tabs.holdings', 'Holdings'),
      history: t('asset.tabs.history', 'History'),
      about: t('asset.tabs.about', 'About'),
    }),
    [t]
  );

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center px-2">
        <View className="w-10">
          <VBack accessibilityLabel={t('common.back', 'Back')} />
        </View>
        <View className="flex-1 flex-row items-center justify-center gap-2">
          <View className="items-center">
            <VText className="text-title font-semibold">{symbol}</VText>
            <VText className="text-2xs text-muted">{tag}</VText>
          </View>
        </View>
        <VPressable
          className="w-10 p-2"
          accessibilityLabel={t('asset.alerts', 'Alerts')}
          onPress={() => {}}
        >
          <VIcon type="Feather" name="bell" size={18} className="text-title" />
        </VPressable>
      </View>

      {/* Chart */}
      <View className="flex-1">
        <ChartWebView pair={pair} colorScheme={colorScheme} />
      </View>

      {/* Tabs & Panels */}
      <View className="flex-1">
        <View className="px-3 mt-4 flex-row gap-6">
          {(['holdings', 'history', 'about']).map((key) => {
            const label = TABS[key];
            const selected = tab === key;
            return (
            <VPressable key={key} onPress={() => setTab(key)} accessibilityRole="tab">
          <VText className={selected ? 'text-title font-semibold' : 'text-muted'}>
            {label}
          </VText>
          {selected && <View className="h-0.5 bg-title rounded mt-1" />}
        </VPressable>
        );
        })}
      </View>

      {tab === 'holdings' && (
        <View className="px-3 mt-4">
          {asset ? (
            <RowWallet item={asset} isActive onPress={() => {}} />
          ) : (
            <View className="bg-item border border-border-subtle rounded-2xl p-4">
              <VText className="text-2xs text-muted">
                {t('asset.noActiveWallet', 'No active wallet selected.')}
              </VText>
            </View>
          )}
        </View>
      )}

      {tab === 'history' && (
        <View className="px-3 mt-4">
          <HistoryTab asset={asset} />
        </View>
      )}

      {tab === 'about' && (
        <View className="px-3 mt-4">
          <VText className="text-muted text-xs">
            {t('asset.aboutComingSoon', 'About information coming soon.')}
          </VText>
        </View>
      )}
    </View>

{/* Bottom Actions */}
  <View className="absolute left-0 right-0 bottom-0 bg-app border-t border-border-subtle">
    <View className="flex-row px-2 py-2">
      <Action
        icon="chevron-up"
        label={t('home.actions.send', 'Send')}
        onPress={() => navigation.navigate('WalletSendScreen', { assetId })}
      />
      <Action
        icon="chevron-down"
        label={t('home.actions.receive', 'Receive')}
        onPress={() => navigation.navigate('WalletReceiveScreen', { assetId })}
      />
      <Action
        icon="swap-horizontal"
        label={t('swapScreen.title', 'Swap')}
        onPress={() => {}}
      />
      <Action
        icon="flash"
        label={t('home.actions.fund', 'Buy')}
        onPress={canOpen ? openBuy : undefined}
      />
      <Action
        icon="card"
        label={t('home.actions.sell', 'Sell')}
        onPress={canOpen ? openSell : undefined}
      />
    </View>
  </View>
</View>
);
}
