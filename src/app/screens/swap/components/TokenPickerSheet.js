// src/features/swap/ui/TokenPickerSheet.js
import React, { forwardRef, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import TokenRow from './TokenRow';
import useSwapTokenList from '@src/app/screens/swap/hook/useSwapTokenList';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

const normalize = (v) => String(v ?? '').trim().toLowerCase();
const keyFor = (t) => normalize(t?.address || t?.symbol || t?.id);

const TokenPickerSheet = forwardRef(function TokenPickerSheet(
  {
    chain,
    title,
    onSelect,
    tokens,                 // optional external list
    exclude = [],           // array of address/symbol/id to exclude
  },
  ref
) {
  const { t } = useTranslation();
  const { list } = useSwapTokenList({ chain });

  // Stable source
  const source = useMemo(
    () => (Array.isArray(tokens) ? tokens : list || []),
    [tokens, list]
  );

  const [query, setQuery] = useState('');

  // Build exclude set (case-insensitive)
  const excludeSet = useMemo(() => new Set(exclude.map(normalize)), [exclude]);

  // Apply exclude first, then search filter
  const filtered = useMemo(() => {
    const base = source.filter((x) => !excludeSet.has(keyFor(x)));
    const q = normalize(query);
    if (!q) return base;
    return base.filter((x) =>
      normalize(x.symbol).includes(q) ||
      normalize(x.name).includes(q) ||
      normalize(x.address).includes(q)
    );
  }, [source, excludeSet, query]);

  return (
    <VBottomSheet
      ref={ref}
      snapPoints={['75%']}
      initialIndex={0}
      indicatorColor="#2C3746"
    >
      <View className="py-2 px-4">
        <VText className="text-title font-semibold text-base mb-2">
          {title ?? t('tokenSheet.title', 'Select token')}
        </VText>
        <View className="flex-row items-center border border-border-subtle rounded-xl px-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('tokenSheet.searchPlaceholder', 'Search token or address')}
            placeholderTextColor="#888"
            className="flex-1 text-title h-10"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="search"
          />
        </View>
      </View>

      <View className="flex-1 mt-2 px-4">
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(it) => it?.id ?? keyFor(it)}
          estimatedItemSize={72}
          renderItem={({ item }) => (
            <TokenRow
              item={item}
              onPress={(x) => onSelect?.(x)}
            />
          )}
          ItemSeparatorComponent={VItemSeparator}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-10">
              <VText className="text-muted">
                {query
                  ? t('tokenSheet.noMatches', 'No matches for your search')
                  : t('tokenSheet.noTokens', 'No tokens available')}
              </VText>
            </View>
          }
        />
      </View>
    </VBottomSheet>
  );
});

export default TokenPickerSheet;
