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
const FEATURED = [
  {
    id: 'uniswap',
    title: 'Uniswap',
    subtitle: 'Swap tokens on Ethereum & L2s.',
    url: 'https://app.uniswap.org/swap',
    icon: 'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  },
  {
    id: 'pancake',
    title: 'PancakeSwap',
    subtitle: 'DEX on BNB Chain.',
    url: 'https://pancakeswap.finance/',
    icon: 'https://coin-images.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png?1696512440',
  },
  {
    id: 'aave',
    title: 'Aave',
    subtitle: 'Open-source lending protocol.',
    url: 'https://app.aave.com/',
    icon: 'https://assets.coingecko.com/coins/images/12645/standard/AAVE.png',
  },
  {
    id: 'lido',
    title: 'Lido Staking',
    subtitle: 'Liquid staking for ETH.',
    url: 'https://stake.lido.fi/',
    icon: 'https://assets.coingecko.com/coins/images/13573/standard/Lido_DAO.png',
  },
  {
    id: 'eigenlayer',
    title: 'EigenLayer',
    subtitle: 'Restake and secure Ethereum.',
    url: 'https://app.eigenlayer.xyz/',
    icon: 'https://app.eigenlayer.xyz/logo/markLightA.svg',
  },
  {
    id: 'pendle',
    title: 'Pendle',
    subtitle: 'Tokenize and trade yield.',
    url: 'https://app.pendle.finance/',
    icon: 'https://app.pendle.finance/assets/pendle-logo-dark-k7USIy1I.png',
  },
  {
    id: 'compound',
    title: 'Compound',
    subtitle: 'Algorithmic lending protocol.',
    url: 'https://app.compound.finance/',
    icon: 'https://assets.coingecko.com/coins/images/10775/standard/COMP.png',
  },
  {
    id: 'curve',
    title: 'Curve Finance',
    subtitle: 'Stablecoin DEX for deep liquidity.',
    url: 'https://curve.fi/',
    icon: 'https://www.curve.finance/assets/curve-logo-B24yuaB8.png',
  },
  {
    id: '1inch',
    title: '1inch',
    subtitle: 'DEX aggregator with best rates.',
    url: 'https://app.1inch.io/',
    icon: 'https://assets.coingecko.com/coins/images/13469/standard/1inch-token.png',
  },
  {
    id: 'sushiswap',
    title: 'SushiSwap',
    subtitle: 'Multi-chain DEX & yield farming.',
    url: 'https://www.sushi.com/swap',
    icon: 'https://assets.coingecko.com/coins/images/12271/standard/512x512_Logo_no_chop.png',
  },
  {
    id: 'raydium',
    title: 'Raydium',
    subtitle: 'AMM + order book on Solana.',
    url: 'https://raydium.io/',
    icon: 'https://img-v1.raydium.io/icon/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png',
  },
  {
    id: 'jupiter',
    title: 'Jupiter',
    subtitle: 'Best swap aggregator on Solana.',
    url: 'https://jup.ag/',
    icon: 'https://jup.ag/_next/image?url=%2Fsvg%2Fjupiter-logo.png&w=48&q=75',
  },
  {
    id: 'opensea',
    title: 'OpenSea',
    subtitle: 'Largest NFT marketplace.',
    url: 'https://opensea.io/',
    icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/35744.png',
  },
  {
    id: 'zapper',
    title: 'Zapper',
    subtitle: 'DeFi dashboard & portfolio tracker.',
    url: 'https://zapper.fi/',
    icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32085.png',
  },
  {
    id: 'defillama',
    title: 'DefiLlama',
    subtitle: 'DeFi analytics and TVL tracker.',
    url: 'https://defillama.com/',
    icon: 'https://defillama.com/icons/defillama.webp',
  },
  {
    id: 'aerodrome',
    title: 'Aerodrome',
    subtitle: 'Base ecosystem DEX & liquidity hub.',
    url: 'https://aerodrome.finance/',
    icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/29270.png',
  }
];

const isLikelyUrl = (q) => {
  if (!q) return false;
  if (/^[a-z]+:\/\//i.test(q)) return true;
  return /^\w[\w-]*(\.\w[\w-]*)+([/:?#].*)?$/i.test(q);
};
const normalizeUrl = (q) => (/^[a-z]+:\/\//i.test(q) ? q : `https://${q}`);

export default function DappsDiscoverScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const { t } = useTranslation();
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
      title: `${q} - Google Search`,
      subtitle: 'https://google.com',
      url,
      icon: 'external-link',
    };
  }, [query]);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    if (!q) return FEATURED;
    return FEATURED.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q) ||
        d.url.toLowerCase().includes(q)
    );
  }, [query]);

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
      {/* Search bar */}
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

      {/* Suggestion section */}
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
      {/* Featured list */}
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
