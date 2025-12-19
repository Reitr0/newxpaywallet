// src/pages/token/ManageCryptoScreen.js
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VImage from '@src/shared/ui/primitives/VImage';
import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VSearchBar from '@src/shared/ui/primitives/VSearchBar';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VSwitch from '@src/shared/ui/primitives/VSwitch';
import useManageCrypto from '@src/app/screens/token/hooks/useManageCrypto';

/* ----------------------------- UI bits ----------------------------- */

function NetworkTag({ label, active, onPress }) {
  return (
    <VPressable
      onPress={onPress}
      className={[
        'px-3 py-1.5 rounded-full border mr-2',
        active ? 'bg-link border-link' : 'bg-item border-border-subtle',
      ].join(' ')}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <VText className={active ? 'text-inverse font-semibold' : 'text-title'}>
        {label}
      </VText>
    </VPressable>
  );
}

function RowManageCoin({ item, enabled, onToggle }) {
  const { t } = useTranslation();
  const isNative = item.type === 'native';
  const imgSrc = item.logo
    ? (typeof item.logo === 'string' ? { uri: item.logo } : item.logo)
    : undefined;

  return (
    <View className="flex-row items-center py-3">
      <VImage source={imgSrc} className="w-9 h-9 rounded-full mr-3" />
      <View className="flex-1">
        <View className="flex-row items-center">
          <VText className="text-title text-base font-semibold mr-2">
            {item.symbol}
          </VText>
          <View className="px-2 py-0.5 rounded-full bg-item">
            <VText className="text-xs text-muted">
              {item.network}
              {isNative ? ` · ${t('manageCrypto.native', 'native')}` : ''}
            </VText>
          </View>
        </View>
        <VText className="text-muted mt-0.5" numberOfLines={1}>
          {item.name}
        </VText>
      </View>

      <VSwitch
        value={enabled}
        disabled={isNative}
        onValueChange={(v) => onToggle(item, v)}
        trackColor={{ false: '#C7C7CC', true: '#0025FF' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/* -------------------------- Screen component -------------------------- */

export default function ManageCryptoScreen() {
  const { t } = useTranslation();
  const {
    status,
    rows: rowsAll, // filtered already
    enabled,
    networkTags,          // [{ id, label }]
    network,
    setNetwork,
    query,
    setQuery,
    onToggle,
    onAddToken,
  } = useManageCrypto();

  const assetCountLabel =
    status !== 'ready'
      ? t('manageCrypto.loading', 'Loading…')
      : t('manageCrypto.assetsCount', '{{count}} asset', {
        count: rowsAll.length,
        plural: 'assets',
      }).replace('asset', rowsAll.length === 1 ? 'asset' : 'assets');

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center justify-between px-3">
        <View className="w-12">
          <VBack />
        </View>
        <VText className="text-title text-lg font-semibold">
          {t('manageCrypto.title', 'Manage crypto')}
        </VText>
        <VPressable
          onPress={onAddToken}
          className="w-12 flex-row justify-end"
          accessibilityLabel={t('manageCrypto.addToken', 'Add token')}
        >
          <VIcon
            type="MaterialCommunityIcons"
            name="plus"
            size={24}
            className="text-title"
          />
        </VPressable>
      </View>

      {/* Search */}
      <View className="px-4 mt-3 h-12">
        <VSearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder={t('manageCrypto.searchPlaceholder', 'Search tokens')}
          accessibilityLabel={t('manageCrypto.search', 'Search tokens')}
        />
      </View>

      {/* Network Tabs */}
      <View className="px-4 mt-3">
        <VFlatList
          data={networkTags}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => (
            <NetworkTag
              label={item.label}
              active={network === item.id}
              onPress={() => setNetwork(item.id)}
            />
          )}
          contentContainerClassName="pb-1"
        />
      </View>

      {/* Status */}
      <View className="px-4 mt-2 flex-row justify-between items-center">
        <VText className="text-muted text-xs">{assetCountLabel}</VText>
      </View>

      {/* Token list */}
      <View className="flex-1 px-4 mt-1">
        <VFlatList
          data={rowsAll}
          estimatedItemSize={72}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => (
            <RowManageCoin
              item={item}
              enabled={!!enabled[item.id]}
              onToggle={onToggle}
            />
          )}
          ItemSeparatorComponent={VItemSeparator}
          contentContainerClassName="pb-16"
        />
      </View>
    </View>
  );
}
