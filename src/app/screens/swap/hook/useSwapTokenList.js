// src/features/swap/hooks/useSwapTokenList.js
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { walletStore } from '@features/wallet/state/walletStore';
import { tokenPriceStore } from '@features/tokens/price/state/tokenPriceStore';
import { tokenRegistryStore } from '@features/tokens/registry/state/tokenRegistryStore';
import { CHAIN_ID_TO_FAMILY, FAMILY_TO_CHAIN_ID } from '@src/shared/config/chain/constants';
import { networkStore } from '@features/network/state/networkStore';

const toNum = (x, f = 0) => (Number.isFinite(+x) ? +x : f);

// map chain family -> default ids (keep id format: chain:symbol:address)
// fill out more chains as needed
const DEFAULT_PAIR_BY_CHAIN = {
  ethereum: {
    from: '1:eth',
    to:   '1:usdt:0xdac17f958d2ee523a2206206994597c13d831ec7',
  },
  bsc: {
    from: '56:bnb', // adjust to your id format if different
    to:   '56:usdt:0x55d398326f99059ff775485246999027b3197955',
  },
  polygon: {
    from: '137:pol',
    to:   '137:usdt:0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  },
  arbitrum: {
    from: '42161:eth',
    to:   '42161:usdt:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
  },
  optimism: {
    from: '10:eth',
    to:   '10:usdt:0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
  },
  avalanche: {
    from: '43114:avax',
    to:   '43114:usdt:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
  },
  base: {
    from: '8453:eth',
    to:   '8453:usdc:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // 0x prefers USDC on Base
  },
};

function enrich(asset, prices) {
  // price key like ETHUSDT (special-case USDT)
  const priceKey = asset?.symbol === 'USDT'
    ? 'USDTDAI'
    : `${asset?.symbol ?? ''}USDT`;

  const chainKey =
    asset?.chain ||
    CHAIN_ID_TO_FAMILY?.[asset?.chainId] ||
    undefined;

  const pr = prices?.[priceKey];
  const price = toNum(pr?.price, toNum(asset?.price, 0));
  const balanceNum = toNum(asset?.balanceNum, toNum(asset?.balance, 0));
  const usdValue = balanceNum * price;

  const networkConfig = chainKey ? networkStore.getConfig?.(chainKey) : undefined;

  return {
    id: asset?.id, // keep original id format: chain:symbol:address
    chain: chainKey,
    symbol: asset?.symbol,
    name: asset?.name || asset?.symbol,
    address: (!!asset?.isToken || asset?.isToken === true)
      ? (asset?.tokenAddress || asset?.address)
      : null, // null if native
    isToken: !!asset?.isToken,
    decimals: toNum(asset?.decimals, asset?.isToken ? 18 : 18),
    balanceNum,
    price,
    usdValue,
    networkLogoUrl: asset?.networkLogoUrl || networkConfig?.logoUrl || null,
  };
}

export default function useSwapTokenList({ chain } = {}) {
  const familyKey = String(chain || '').toLowerCase(); // e.g. 'ethereum'
  const { assets } = useSnapshot(walletStore);
  const { prices } = useSnapshot(tokenPriceStore);
  const { data: regData } = useSnapshot(tokenRegistryStore); // { ethereum: [...], bsc: [...] }

  const { list, defaultFrom, defaultTo } = useMemo(() => {
    // wallet assets for this chain
    const walletAssets = Array.isArray(assets)
      ? assets.filter(a => String(a.chain).toLowerCase() === familyKey)
      : [];
    const walletEnriched = walletAssets.map(a => enrich(a, prices));

    // registry tokens for this chain (guard against undefined)
    const registryTokens = Array.isArray(regData?.[FAMILY_TO_CHAIN_ID[familyKey]]) ? regData[FAMILY_TO_CHAIN_ID[familyKey]] : [];
    const registryEnriched = registryTokens.map(a => enrich(a, prices));

    // merge: wallet overrides registry (by id)
    const map = new Map();
    for (const t of registryEnriched) map.set(t.id, t);
    for (const t of walletEnriched) map.set(t.id, t);
    const merged = Array.from(map.values());

    // sort by USD value desc, then symbol
    merged.sort(
      (a, b) => (b.usdValue - a.usdValue) || String(a.symbol).localeCompare(String(b.symbol))
    );

    // per-chain defaults
    const defaults = DEFAULT_PAIR_BY_CHAIN[familyKey] || DEFAULT_PAIR_BY_CHAIN.ethereum;
    const from = merged.find(t => t.id === defaults.from) || null;
    const to   = merged.find(t => t.id === defaults.to)   || null;

    return { list: merged, defaultFrom: from, defaultTo: to };
  }, [assets, prices, regData, familyKey]);

  return { list, defaultFrom, defaultTo };
}
