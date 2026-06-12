// src/features/browser/ui/DappsDiscoverScreen.jsx
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VText from '@src/shared/ui/primitives/VText';
import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VImage from '@src/shared/ui/primitives/VImage';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import VListEmpty from '@src/shared/ui/molecules/VListEmpty';
import VSearchBar from '@src/shared/ui/primitives/VSearchBar';
import { useTranslation } from 'react-i18next';

const isLikelyUrl = (q) => {
  if (!q) return false;
  if (/^[a-z]+:\/\//i.test(q)) return true;
  return /^\w[\w-]*(\.\w[\w-]*)+([/:?#].*)?$/i.test(q);
};
const normalizeUrl = (q) => (/^[a-z]+:\/\//i.test(q) ? q : `https://${q}`);

export default function DappsDiscoverScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const { t } = useTranslation();

  // Define FEATURED inside useMemo so 't' can translate them dynamically
  const FEATURED = useMemo(() => [
    {
      id: 'slxdex',
      title: t('dapps.slxdex.title', 'SLX Decentralized Exchange'),
      subtitle: t('dapps.slxdex.subtitle', 'SLX Decentralized exchanger'),
      url: 'https://slxdex.com',
      icon: 'https://i.ibb.co/7WkxZZ2/Untitled-3.png',
    },
    {
      id: 'rwa',
      title: t('dapps.rwa.title', 'RWA-T Global'),
      subtitle: t('dapps.rwa.subtitle', 'SLX Real World Asset'),
      url: '',
      icon: 'https://i.ibb.co/7WkxZZ2/Untitled-3.png',
    },
    {
      id: 'solxscan',
      title: t('dapps.solxscan.title', 'Slxscan'),
      subtitle: t('dapps.solxscan.subtitle', 'SLX Foundation Scan'),
      url: 'https://Slxscan.io',
      icon: 'https://i.ibb.co/7WkxZZ2/Untitled-3.png',
    },
  ], [t]);

  const open = useCallback(
    (url) => {
      navigation.navigate('DappsBrowserScreen', { initialUrl: url });
    },
    [navigation]
  );

  const suggestion = useMemo(() => {
    const q = (query || '').trim();
    if (!q) return null;
    if (isLikelyUrl(q)) {
      const url = normalizeUrl(q);
      return { kind: 'direct', title: q, subtitle: url, url, icon: 'globe' };
    }
    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    return {
      kind: 'search',
      title: `${q} - ${t('dappBrowserScreen.googleSearch', 'Google Search')}`,
      subtitle: 'https://google.com',
      url,
      icon: 'external-link',
    };
  }, [query, t]);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    if (!q) return FEATURED;
    return FEATURED.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q) ||
        d.url.toLowerCase().includes(q)
    );
  }, [query, FEATURED]);

  const renderFeaturedItem = useCallback(
    ({ item }) => (
      <VPressable onPress={() => open(item.url)}>
        <View className="flex-row items-center py-3">
          <VImage source={{ uri: item.icon }} className="w-12 h-12 rounded-xl mr-3" />
          <View className="flex-1">
            <VText className="text-base font-semibold text-title">{item.title}</VText>
            <VText numberOfLines={1} className="text-sm text-muted">
              {item.subtitle}
            </VText>
          </View>
          <VIcon name="chevron-right" size={18} className="text-muted" />
        </View>
      </VPressable>
    ),
    [open]
  );

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 h-12">
        <VSearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder={t(
            'dappBrowserScreen.searchPlaceholder',
            'Search or enter URL'
          )}
          onSubmitEditing={() => suggestion && open(suggestion.url)}
        />
      </View>

      <View className="px-4 mt-2">
        {suggestion ? (
          <VPressable onPress={() => open(suggestion.url)}>
            <View className="flex-row items-center py-3">
              <VIcon
                name={suggestion.icon === 'globe' ? 'globe' : 'external-link'}
                size={18}
                className="text-title mr-3"
              />
              <View className="flex-1">
                <VText className="text-base font-semibold text-title">{suggestion.title}</VText>
                <VText numberOfLines={1} className="text-xs text-muted">
                  {suggestion.subtitle}
                </VText>
              </View>
              <VIcon name="arrow-up-right" size={16} className="text-muted" />
            </View>
          </VPressable>
        ) : null}
      </View>
      <VFlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderFeaturedItem}
        ItemSeparatorComponent={VItemSeparator}
        ListEmptyComponent={VListEmpty}
        estimatedItemSize={76}
        className={'px-4'}
      />
    </View>
  );
}