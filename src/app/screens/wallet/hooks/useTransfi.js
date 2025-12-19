// src/features/exchange/hooks/useTransfi.js
import { useMemo, useCallback } from 'react';

/** Minimal mapper for TransFi params (expand as needed) */
export function mapAssetToTransfi(asset) {
  if (!asset) return { cryptoNetwork: 'Bitcoin', cryptoTicker: 'BTC' };

  const chain = String(asset.chain || '').toLowerCase();
  const symbol = String(asset.symbol || '').toUpperCase();

  const networkMap = {
    bitcoin: 'Bitcoin',
    btc: 'Bitcoin',
    ethereum: 'Ethereum',
    eth: 'Ethereum',
    bsc: 'BinanceSmartChain',
    binance: 'BinanceSmartChain',
    polygon: 'Polygon',
    matic: 'Polygon',
    tron: 'Tron',
    solana: 'Solana',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    avalanche: 'Avalanche',
  };

  return {
    cryptoNetwork: networkMap[chain] || 'Bitcoin',
    cryptoTicker: symbol || 'BTC',
  };
}

/**
 * useTransfi
 * - Builds base TransFi params from an asset
 * - Provides openBuy/openSell helpers that navigate to WalletExchangeScreen
 *
 * @param {object} options
 * @param {object|null} options.asset - wallet asset (must include .address, .chain, .symbol)
 * @param {object} options.navigation - react-navigation navigation
 * @param {string} [options.country='VN'] - default country
 * @param {string} [options.fiatTicker='VND'] - default fiat ticker
 */
export default function useTransfi({
                                     asset,
                                     navigation,
                                     country = 'VN',
                                     fiatTicker = 'VND',
                                   } = {}) {
  const baseParams = useMemo(() => {
    if (!asset) return null;
    const { cryptoNetwork, cryptoTicker } = mapAssetToTransfi(asset);

    return {
      walletAddress: asset.address, // user's receive address on this network
      cryptoNetwork,
      cryptoTicker,
      country,
      fiatTicker,
      // You may also pass: fiatAmount, partnerContext, paymentCode
    };
  }, [asset, country, fiatTicker]);

  const canOpen = !!(baseParams && baseParams.walletAddress);

  const toExchange = useCallback(
    (view /* 'buy' | 'sell' */, extra = {}) => {
      if (!canOpen) return;
      navigation?.navigate?.('WalletExchangeScreen', {
        view,
        ...baseParams,
        ...extra,
      });
    },
    [navigation, baseParams, canOpen]
  );

  const openBuy = useCallback(() => toExchange('buy'), [toExchange]);
  const openSell = useCallback(() => toExchange('sell'), [toExchange]);

  return {
    baseParams,  // null or the params object
    canOpen,
    openBuy,
    openSell,
    toExchange,  // generic if you need custom extras later
  };
}
