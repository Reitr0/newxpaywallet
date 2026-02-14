// src/pages/asset/ui/AssetDetailScreen.js
import React, { useCallback, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { appearanceStore } from '@features/settings/appearance/state/appearanceStore';
import { tokenRegistryStore } from '@features/tokens/registry/state/tokenRegistryStore';
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
  const chain = asset?.chain || asset?.chainId || '';
  const pair = symbol === 'USDT' ? `${symbol}DAI` : `${symbol}USDT`;
  
  // Get token logo from registry
  const tokenLogo = useMemo(() => {
    // First try asset's own logo
    if (asset?.logo) return asset.logo;
    if (asset?.logoUrl) return asset.logoUrl;
    
    // Map chain name to registry chainKey
    const chainKeyMap = {
      'ethereum': '1',
      'eth': '1',
      'bsc': '56',
      'binance': '56',
      'bnb': '56',
      'polygon': '137',
      'matic': '137',
      'solana': 'solana',
      'sol': 'solana',
      'tron': 'tron',
      'trx': 'tron',
    };
    const chainKey = chainKeyMap[chain?.toLowerCase()] || chain;
    
    // Then lookup from token registry by symbol and chain
    const tokenFromRegistry = tokenRegistryStore.findBySymbol(chainKey, symbol);
    if (tokenFromRegistry?.logo) return tokenFromRegistry.logo;
    
    // Also try with chainId directly
    const chainIdKey = asset?.chainId ? String(asset.chainId) : null;
    if (chainIdKey && chainIdKey !== chainKey) {
      const tokenByChainId = tokenRegistryStore.findBySymbol(chainIdKey, symbol);
      if (tokenByChainId?.logo) return tokenByChainId.logo;
    }
    
    // Fallback to network logo - but only for native tokens, not for ERC20/tokens
    // For tokens, show placeholder instead of chain logo
    if (!asset?.isToken) {
      return asset?.networkLogoUrl || null;
    }
    
    return null;
  }, [asset, chain, symbol]);
  
  // State for chart loading - if chart fails, show token logo instead
  const [chartFailed, setChartFailed] = useState(false);
  
  // Tokens that don't have chart data on Binance/TradingView
  // Include all Solana X custom tokens (they have "Solana X" in label or specific contract addresses)
  const NO_CHART_TOKENS = ['XUSDT', 'JYB', 'SLX', 'BUSD'];
  
  // Solana X custom token addresses (lowercase for comparison)
  const SOLANA_X_ADDRESSES = [
    'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4', // XUSDT
    '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8', // JYB
    '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf', // BTC Solana X
    '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell', // ETH Solana X
    'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a', // LTC Solana X
    '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd', // DOGE Solana X
    '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh', // USDC Solana X
    'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh', // SLX
  ];
  
  const tokenAddressLower = (asset?.tokenAddress || '').toLowerCase();
  const isSolanaXToken = chain === 'solana' && (
    asset?.label?.includes('Solana X') || 
    asset?.tag?.includes('Solana X') ||
    SOLANA_X_ADDRESSES.includes(tokenAddressLower) ||
    NO_CHART_TOKENS.includes(symbol)
  );
  // Show chart only if not Solana X token, not in NO_CHART list, and chart hasn't failed
  const hasChart = !isSolanaXToken && !NO_CHART_TOKENS.includes(symbol) && !chartFailed;
  
  // Callback when chart fails to load (Heroku error, timeout, etc.)
  const handleChartFailed = useCallback(() => {
    setChartFailed(true);
  }, []);

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

      {/* Chart - only show for tokens with chart data */}
      {hasChart ? (
        <View style={{ height: 200 }}>
          <ChartWebView 
            pair={pair} 
            colorScheme={colorScheme} 
            tokenLogo={tokenLogo} 
            tokenSymbol={symbol} 
            onChartFailed={handleChartFailed}
          />
        </View>
      ) : (
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {tokenLogo ? (
            <Image 
              source={{ uri: tokenLogo }} 
              style={{ width: 64, height: 64, borderRadius: 32 }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <VText className="text-2xl text-white font-bold">{symbol?.slice(0, 1) || '?'}</VText>
            </View>
          )}
        </View>
      )}

      {/* Tabs & Panels - more space */}
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
      {/* <Action
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
      /> */}
    </View>
  </View>
</View>
);
}
