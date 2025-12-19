// src/features/wallet/hooks/useWallet.js
import { useCallback, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';

import { tokenPriceStore } from '@features/tokens/price/state/tokenPriceStore';
import { walletStore } from '@features/wallet/state/walletStore';

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function enrichAsset(asset, priceRow) {
  const price = toNum(priceRow?.price, toNum(asset?.price, 0));
  const priceChangePercent =
    Number.isFinite(priceRow?.priceChangePercent)
      ? priceRow.priceChangePercent
      : Number.isFinite(asset?.priceChangePercent)
        ? asset.priceChangePercent
        : 0;

  const balanceNum = toNum(asset?.balanceNum, toNum(asset?.balance, 0));
  const usdValue = balanceNum * price;

  return {
    ...asset,
    price,
    priceChangePercent,
    balanceNum,
    usdValue,
  };
}

// ----------------------------------------------------
// Default chain priority: BTC > ETH > BSC > POLY > SOL > TRON
// ----------------------------------------------------
const CHAIN_PRIORITY = ['bitcoin', 'ethereum', 'bsc', 'polygon', 'solana', 'tron'];

function getChainPriority(chain) {
  const c = String(chain || '').toLowerCase();
  const idx = CHAIN_PRIORITY.indexOf(c);
  return idx >= 0 ? idx : CHAIN_PRIORITY.length; // unknown chains go last
}

export default function useWallet(assetId, options = {}) {
  const { sortBy = null, sortDir = 'desc' } = options;

  const { assets } = useSnapshot(walletStore);
  const { prices } = useSnapshot(tokenPriceStore);
  const [refreshing, setRefreshing] = useState(false);

  const list = useMemo(() => {
    if (!Array.isArray(assets)) return [];

    const enriched = assets.map((a) => {
      const key = a?.symbol === 'USDT' ? 'USDTDAI' : a?.symbol + 'USDT';
      const priceRow = key ? prices?.[key] : undefined;
      return enrichAsset(a, priceRow);
    });

    // --------------------------------------
    // Default: chain priority sort
    // --------------------------------------
    if (!sortBy) {
      return [...enriched].sort((a, b) => {
        const pa = getChainPriority(a.chain);
        const pb = getChainPriority(b.chain);
        if (pa !== pb) return pa - pb;
        // within same chain, sort by USD value descending
        return b.usdValue - a.usdValue;
      });
    }

    // --------------------------------------
    // Custom user sort
    // --------------------------------------


    return [...enriched].sort((a, b) => {
      let valA = a?.[sortBy];
      let valB = b?.[sortBy];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, prices, sortBy, sortDir]);

  const totalUsd = useMemo(() => {
    return list.reduce((sum, it) => sum + toNum(it?.usdValue, 0), 0);
  }, [list]);

  const asset = useMemo(() => {
    if (!assetId) return null;
    return list.find((a) => a.id === assetId) || null;
  }, [list, assetId]);

  const refresh = useCallback(async (opts = {}) => {
    try {
      setRefreshing(true);
      walletStore.fetchBalances(opts);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return {
    list,
    asset,
    totalUsd,
    refreshing,
    sortBy,
    sortDir,
    refresh,
  };
}
