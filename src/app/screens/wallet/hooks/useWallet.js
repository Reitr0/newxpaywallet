// src/features/wallet/hooks/useWallet.js
import { useCallback, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';

import { tokenPriceStore } from '@features/tokens/price/state/tokenPriceStore';
import { walletStore } from '@features/wallet/state/walletStore';

// DEBUG: This log should appear when file is loaded
console.log('========== useWallet.js LOADED v2 ==========');

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
const CHAIN_PRIORITY = ['bitcoin', 'ethereum', 'bsc', 'polygon', 'slx', 'solana', 'tron'];

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

    // Ensure SLX USDT token is present (fallback injection)
    let effectiveAssets = assets;
    const hasSlxUsdt = assets.some(a => a?.chain === 'slx' && a?.symbol === 'USDT');
    if (!hasSlxUsdt) {
      // Find SLX wallet address from existing SLX assets
      const slxAsset = assets.find(a => a?.chain === 'slx');
      const slxAddr = slxAsset?.address;
      if (slxAddr) {
        console.log('🔧 [useWallet] Injecting SLX USDT — not found in store assets');
        const usdtAsset = {
          id: `781234:usdt:0x2b14d8242b186116b6fd628c65d12559e96d522b:${slxAddr}`,
          iconKey: '781234:usdt:0x2b14d8242b186116b6fd628c65d12559e96d522b',
          isToken: true,
          chain: 'slx',
          chainId: '781234',
          symbol: 'USDT',
          decimals: 18,
          tokenAddress: '0x2b14d8242b186116b6fd628c65d12559e96d522b',
          address: slxAddr,
          networkLogoUrl: 'https://i.ibb.co/GC5VBgq/SLX-COIN-241209.png',
          tag: 'SLX Network',
          label: 'TETHER',
          name: 'TETHER',
          logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
          type: 'token',
          balance: '0',
          balanceFormatted: '0',
          balanceUsd: 0,
        };
        // Push into walletStore.assets so fetchBalances can pick it up
        walletStore.assets.push(usdtAsset);
        effectiveAssets = [...assets, usdtAsset];

        // Register token on SLX wallet instance & trigger balance fetch
        const slxInst = walletStore.instances?.slx;
        if (slxInst && typeof slxInst.registerToken === 'function') {
          slxInst.registerToken({
            address: '0x2b14d8242b186116b6fd628c65d12559e96d522b',
            symbol: 'USDT',
            decimals: 18,
            name: 'TETHER',
          }).then(() => {
            console.log('✅ [useWallet] USDT registered on SLX instance');
            // Trigger balance fetch for SLX chain
            walletStore.fetchBalances({ chain: 'slx' });
          }).catch(e => console.warn('USDT register failed:', e?.message));
        }
      }
    }

    const enriched = effectiveAssets.map((a) => {
      // Special mapping for Solana X tokens to use real asset prices
      const SOLANA_X_PRICE_MAP = {
        'XUSDT': 'USDTUSDT',  // Tether AC -> USDT price
        'BTC': 'BTCUSDT',     // Bitcoin Solana X -> BTC price
        'ETH': 'ETHUSDT',     // Ethereum Solana X -> ETH price
        'LTC': 'LTCUSDT',     // Litecoin Solana X -> LTC price
        'DOGE': 'DOGEUSDT',   // Dogecoin Solana X -> DOGE price
        'USDC': 'USDCUSDT',   // USDC Solana X -> USDC price
      };

      // Solana X token contract addresses (lowercase)
      const SOLANA_X_ADDRESSES = [
        'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4', // XUSDT
        '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf', // BTC
        '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell', // ETH
        'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a', // LTC
        '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd', // DOGE
        '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh', // USDC
      ];

      // Check if this is a Solana X token - check multiple possible address fields
      const contractAddr = (
        a?.tokenAddress ||
        a?.address ||
        a?.mint ||
        a?.contractAddress ||
        ''
      ).toLowerCase();

      const isSolanaXToken = SOLANA_X_ADDRESSES.includes(contractAddr);

      // Also check by symbol + chain for Solana X tokens
      const isSolanaChain = a?.chain === 'solana' || a?.chainId === 'solana';
      const isSolanaXBySymbol = isSolanaChain && SOLANA_X_PRICE_MAP[a?.symbol];

      let key;
      if ((isSolanaXToken || isSolanaXBySymbol) && SOLANA_X_PRICE_MAP[a?.symbol]) {
        // Use mapped price for Solana X tokens
        key = SOLANA_X_PRICE_MAP[a.symbol];
      } else if (a?.symbol === 'USDT' || a?.symbol === 'XUSDT') {
        // USDT and XUSDT should use USDT price
        key = 'USDTUSDT';
      } else {
        key = a?.symbol + 'USDT';
      }

      const priceRow = key ? prices?.[key] : undefined;

      // Debug log for XUSDT
      if (a?.symbol === 'XUSDT') {
        console.log('[useWallet] XUSDT debug:', {
          symbol: a?.symbol,
          chain: a?.chain,
          tokenAddress: a?.tokenAddress,
          contractAddr,
          isSolanaXToken,
          isSolanaXBySymbol,
          key,
          priceRow,
          allPriceKeys: Object.keys(prices || {}).slice(0, 10),
        });
      }

      return enrichAsset(a, priceRow);
    });

    // --------------------------------------
    // Default: fixed token display order
    // --------------------------------------
    // Order key uses symbol + chain/tag to distinguish USDT variants
    const TOKEN_ORDER = [
      'BTC:bitcoin',       // BTC (Ori)
      'ETH:ethereum',      // ETH (Ori)
      'BNB:bsc',           // BNB
      'SLX:slx',           // SLX native
      'JYB:solana',        // JYB
      'USDT:slx',          // USDT (SLX)
      'USDT:bsc',          // USDT (BEP20)
      'USDT:ethereum',     // USDT (ERC20)
      'XUSDT:solana',      // XUSDT
    ];

    function getTokenOrder(asset) {
      const sym = (asset?.symbol || '').toUpperCase();
      const ch = (asset?.chain || '').toLowerCase();
      const key = sym + ':' + ch;
      const idx = TOKEN_ORDER.indexOf(key);
      return idx >= 0 ? idx : TOKEN_ORDER.length; // unmatched go after
    }

    if (!sortBy) {
      return [...enriched].sort((a, b) => {
        const oa = getTokenOrder(a);
        const ob = getTokenOrder(b);
        if (oa !== ob) return oa - ob;
        // within same priority, sort by USD value descending
        return (b.usdValue || 0) - (a.usdValue || 0);
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
