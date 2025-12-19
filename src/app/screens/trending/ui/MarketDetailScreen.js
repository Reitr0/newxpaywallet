// src/pages/asset/ui/AssetDetailScreen.js
import React, { useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { appearanceStore } from '@features/settings/appearance/state/appearanceStore';
import ChartWebView from '@src/app/screens/wallet/components/ChartWebView';
import Fiat from '@src/shared/ui/atoms/Fiat';
import Compact from '@src/shared/ui/atoms/Compact';
import Percent from '@src/shared/ui/atoms/Percent';

/* ----------------------------- helpers ----------------------------- */
const fmtDate = (iso) => {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return '—';
  }
};

/* ----------------------------- small UI ---------------------------- */
function InfoRow({ label, value, mono, children }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-3">
      <VText className="text-sm text-muted flex-1">{label}</VText>
      <View className="flex-[2] items-end">
        {children ?? (
          <VText className={`${mono ? 'font-mono' : ''} text-title text-right`}>
            {value}
          </VText>
        )}
      </View>
    </View>
  );
}

/* ----------------------------- component ----------------------------- */
export default function MarketDetailScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { asset } = route.params;
  const { colorScheme } = useSnapshot(appearanceStore);
  const [tab, setTab] = useState('About');

  const symbol = asset?.symbol || '';
  const tag = asset?.name || '';
  const pair = symbol === 'USDT' ? `${symbol}DAI` : `${symbol}USDT`;

  const changeColor =
    typeof asset?.changePct === 'number'
      ? asset.changePct > 0
        ? 'text-up'
        : asset.changePct < 0
          ? 'text-down'
          : 'text-title'
      : 'text-title';

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center px-2">
        <View className="w-10">
          <VBack />
        </View>

        <View className="flex-1 flex-row items-center justify-center gap-2">
          <View className="items-center">
            <VText className="text-title font-semibold">{symbol}</VText>
            <VText className="text-2xs text-muted">{tag}</VText>
          </View>
        </View>

        <VPressable
          className="w-10 p-2"
          accessibilityLabel={t('market.alerts', 'Alerts')}
          accessibilityRole="button"
          disabled
        >
          {/* <VIcon type="Feather" name="bell" size={18} className="text-title" /> */}
        </VPressable>
      </View>

      {/* Chart */}
      <View className="flex-1 px-1">
        <ChartWebView pair={pair} colorScheme={colorScheme} />
      </View>

      {/* Tabs & panels */}
      <View className="flex-1">
        {/* Tabs */}
        <View className="px-3 flex-row gap-6">
          {['About'].map((tabKey) => (
            <VPressable key={tabKey} onPress={() => setTab(tabKey)} accessibilityRole="tab">
              <VText className={`${tab === tabKey ? 'text-title font-semibold' : 'text-muted'}`}>
                {t('market.tabs.about', 'About')}
              </VText>
              {tab === tabKey && <View className="h-0.5 bg-title rounded mt-1" />}
            </VPressable>
          ))}
        </View>

        {/* About Panel */}
        {tab === 'About' && (
          <View className="px-3 mt-4 pb-6">
            {/* Price + Change badge */}
            <View className="flex-row items-center justify-between mb-2">
              <Fiat className="text-xl font-bold" value={asset?.priceUsd}/>
              <View className="px-2 py-1 rounded-full bg-surface-2 flex-row items-center gap-1">
                <VIcon
                  type="Feather"
                  name={asset?.changePct >= 0 ? 'arrow-up-right' : 'arrow-down-right'}
                  size={14}
                  className={changeColor}
                />
                <Percent value={asset?.changePct} />
              </View>
            </View>

            {/* High / Low mini-cards */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 rounded-2xl p-3 bg-item">
                <VText className="text-2xs text-muted mb-1">
                  {t('market.high24h', '24h High')}
                </VText>
                <Fiat className="text-sm text-title" value={asset?.high24h} />
              </View>
              <View className="flex-1 rounded-2xl p-3 bg-item">
                <VText className="text-2xs text-muted mb-1">
                  {t('market.low24h', '24h Low')}
                </VText>
                <Fiat className="text-sm text-title" value={asset?.low24h} />
              </View>
            </View>

            {/* Key/Value list */}
            <InfoRow label={t('market.name', 'Name')} value={asset?.name || '—'} />
            <InfoRow label={t('market.symbol', 'Symbol')} value={asset?.symbol || '—'} />
            <InfoRow
              label={t('market.rank', 'Rank')}
              value={asset?.rank != null ? `#${asset.rank}` : '—'}
            />
            {/* Market Cap */}
            <InfoRow label={t('market.marketCap', 'Market Cap')}>
              <View className="items-end flex-row ">
                <VText className="text-title">
                  <Fiat value={asset?.marketCap} />{' '}(
                </VText>
                <Compact className="text-muted mt-0.5" value={asset?.marketCap} />
                <VText className="text-title">)</VText>
              </View>
            </InfoRow>
            {/* 24h Volume */}
            <InfoRow label={t('market.volume24h', '24h Volume')}>
              <View className="items-end flex-row ">
                <VText className="text-title">
                  <Fiat value={asset?.volumeUsd} />{' '}(
                </VText>
                <Compact className="text-2xs text-muted mt-0.5" value={asset?.volumeUsd} />
                <VText className="text-title">)</VText>
              </View>
            </InfoRow>
            <InfoRow
              label={t('market.lastUpdated', 'Last Updated')}
              value={fmtDate(asset?.lastUpdated)}
            />
          </View>
        )}
      </View>
    </View>
  );
}
