// src/pages/trending/ui/MarketScreen.js
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import VText from '@src/shared/ui/primitives/VText';
import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VImage from '@src/shared/ui/primitives/VImage';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import VListEmpty from '@src/shared/ui/molecules/VListEmpty';
import VSearchBar from '@src/shared/ui/primitives/VSearchBar';

import useTrending from '@src/features/trending/state/useTrending';
import { loadTrending } from '@src/features/trending/state/trendingStore';
import Fiat from '@src/shared/ui/atoms/Fiat';
import Percent from '@src/shared/ui/atoms/Percent';
import Compact from '@src/shared/ui/atoms/Compact';

function RowTrending({ item, onPress, t }) {
  const changeUp = item.changePct >= 0;
  return (
    <VPressable
      onPress={() => onPress?.(item)}
      className="flex-row items-center py-3"
      accessibilityRole="button"
      accessibilityLabel={t('market.row.open', 'Open asset details')}
    >
      <VImage source={{ uri: item.logoUrl }} className="w-12 h-12 mr-3 rounded-full" />
      <View className="flex-1">
        <VText className="text-title font-semibold" numberOfLines={1}>
          {item.name || item.symbol}
        </VText>
        {/* 24h Volume */}
        <VText className="text-muted mt-0.5">
          <Compact value={item.volumeUsd} digits={3} />
        </VText>
      </View>
      <View className="items-end">
        <Fiat value={item.priceUsd} className="text-title" />
        <Percent value={item.changePct} className={changeUp ? 'text-up' : 'text-down'} />
      </View>
    </VPressable>
  );
}

export default function MarketScreen({ navigation }) {
  const { t } = useTranslation();

  const snap = useTrending({ chain: 'all', window: '24h' });
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const data = snap.entities || [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (it) =>
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.symbol && it.symbol.toLowerCase().includes(q))
    );
  }, [snap.entities, query]);

  const onRefresh = useCallback(() => loadTrending({ blocking: true }), []);
  const refreshing = snap.status === 'loading';

  return (
    <View className="flex-1 bg-app">
      {/* Search bar */}
      <View className="px-4 h-12">
        <VSearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder={t('market.searchPlaceholder', 'Search assets')}
          accessibilityLabel={t('market.searchA11y', 'Search for a cryptocurrency')}
        />
      </View>

      {/* Trending List */}
      <View className="flex-1 px-4 mt-2">
        <VFlatList
          data={filtered}
          estimatedItemSize={76}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => (
            <RowTrending
              item={item}
              t={t}
              onPress={(asset) => navigation.navigate('MarketDetailScreen', { asset })}
            />
          )}
          ItemSeparatorComponent={VItemSeparator}
          ListEmptyComponent={
            <VListEmpty
              title={t('market.emptyTitle', 'No results')}
              subtitle={
                query
                  ? t('market.emptySearch', 'Try another search keyword.')
                  : t('market.emptyDefault', 'No trending assets found.')
              }
            />
          }
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </View>
    </View>
  );
}
