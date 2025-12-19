// src/pages/asset/ui/HistoryTab.jsx
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VSpinner from '@src/shared/ui/primitives/VSpinner';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';

import useAssetHistory from '@src/app/screens/wallet/hooks/useAssetHistory';

export function HistoryTab({ asset, sheetRef }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const chain = asset?.chain;
  const tokenAddress = asset?.isToken ? asset?.tokenAddress : null;

  const {
    items, loading, refreshing, loadingMore, error,
    onRefresh, loadMore, retry, hasMore
  } = useAssetHistory({ chain, tokenAddress, pageSize: 20 });

  if (loading && items.length === 0) {
    return (
      <View className="px-3 mt-6 items-center">
        <VSpinner />
        <VText className="text-2xs text-muted mt-2">
          {t('history.loading', 'Loading history...')}
        </VText>
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View className="px-3 mt-6">
        <VText className="text-2xs text-error mb-2">{error}</VText>
        <VPressable onPress={retry} className="px-3 py-2 bg-item rounded-xl self-start">
          <VText className="text-2xs text-title">{t('common.retry', 'Retry')}</VText>
        </VPressable>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View className="px-3 mt-6">
        <VText className="text-2xs text-muted">
          {t('history.empty', 'No recent activity.')}
        </VText>
      </View>
    );
  }

  return (
    <VFlatList
      data={items}
      keyExtractor={(it) => String(it.hash)}
      renderItem={({ item }) => (
        <TxRow
          tx={item}
          onPress={() =>
            navigation.navigate('WalletTxDetailScreen', {
              url: item.explorerUrl,
              tx: item,
              title: t('history.txTitle', 'Transaction'),
            })
          }
        />
      )}
      onRefresh={onRefresh}
      refreshing={refreshing}
      onEndReachedThreshold={0.3}
      onEndReached={loadMore}
      ListFooterComponent={
        loadingMore ? (
          <View className="py-3 items-center justify-center">
            <VSpinner />
          </View>
        ) : hasMore ? (
          <View className="py-3 items-center">
            <VPressable onPress={loadMore} className="px-4 py-2 bg-item rounded-xl">
              <VText className="text-2xs text-title">
                {t('common.loadMore', 'Load more')}
              </VText>
            </VPressable>
          </View>
        ) : null
      }
    />
  );
}

/** Row */
function TxRow({ tx, onPress }) {
  const { t } = useTranslation();
  const directionIn = tx.direction === 'in';
  const direction = directionIn
    ? t('history.received', 'Received')
    : t('history.sent', 'Sent');
  const color = directionIn ? 'text-up' : 'text-down';
  const prefixAmount = directionIn ? '+' : '-';

  const subtitle = useMemo(() => {
    const ts = tx.timestamp ? new Date(tx.timestamp) : null;
    const when = ts ? ts.toLocaleString() : t('history.unknownTime', 'Unknown time');
    const shortHash = tx.hash ? `${tx.hash.slice(0, 8)}…` : '';
    return `${when}  ${shortHash}`;
  }, [tx.timestamp, tx.hash, t]);

  return (
    <VPressable onPress={onPress} className="flex-row justify-between items-center py-3">
      <View className="flex-1">
        <VText className={`font-semibold ${color}`}>{direction}</VText>
        <VText className="text-2xs text-muted mt-0.5">{subtitle}</VText>
      </View>
      <View className="items-end">
        <VText className={`font-semibold ${color}`}>
          {prefixAmount}
          <CryptoAmount
            className={`font-semibold ${color}`}
            amount={tx.value}
            symbol={tx.symbol}
          />
        </VText>
      </View>
    </VPressable>
  );
}
