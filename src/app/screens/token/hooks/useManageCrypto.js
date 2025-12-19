// src/features/wallet/hooks/useManageCrypto.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { walletStore } from '@src/features/wallet/state/walletStore';
import { walletRegistryStore } from '@features/wallet/state/walletRegistryStore';
import { tokenRegistryStore, useTokenRegistry } from '@features/tokens/registry/state/tokenRegistryStore';
import log from '@src/shared/infra/log/logService';
import { CHAIN_ID_TO_FAMILY, CHAIN_TAGS } from '@src/shared/config/chain/constants';


export default function useManageCrypto() {
    const [query, setQuery] = useState('');
    const [network, setNetwork] = useState('all');
    // Load static + user registries once
    useEffect(() => {
        tokenRegistryStore.loadAll();
    }, []);
    const { data: registryData, status } = useTokenRegistry();
    const { data: walletRegistryData } = useSnapshot(walletRegistryStore);

    const rows = useMemo(() => {
        if (!registryData) return [];
        const out = [];
        const chainKeys = ['1','56','137','solana','tron'];
        for (let ci = 0; ci < chainKeys.length; ci++) {
            const chainKey = chainKeys[ci];
            const netId   = CHAIN_ID_TO_FAMILY[chainKey] || 'unknown';
            const netName = (CHAIN_TAGS.find(t => t.id === netId)?.label) || netId;
            const tokens  = registryData?.[chainKey] || [];

            for (let ti = 0; ti < tokens.length; ti++) {
                const t = tokens[ti];
                const id = `${chainKey}:${t.symbol}:${t.address}`.toLowerCase();
                out.push({
                    id,
                    type: 'token',
                    networkId: netId,
                    networkChainKey: chainKey, // '1' | '56' | '137' | 'solana' | 'tron'
                    network: netName,
                    symbol: t.symbol,
                    name: t.name || t.symbol,
                    address: t.address?.toLowerCase?.(),
                    decimals: t.decimals,
                    logo: t.logo ? t.logo : undefined,
                });
            }
        }

        // Filter by selected network
        const byNetwork = network === 'all' ? out : out.filter(r => r.networkId === network);

        // Search filter
        const q = query.trim().toLowerCase();
        const filtered = q
            ? byNetwork.filter(r =>
                r.symbol?.toLowerCase().includes(q) ||
                r.name?.toLowerCase().includes(q) ||
                r.address?.toLowerCase?.().includes(q)
            )
            : byNetwork;

        // Sort by (network order, symbol)
        const orderIndex = (nid) => {
            const i = CHAIN_TAGS.findIndex(x => x.id === nid);
            return i < 0 ? 999 : i;
        };
        filtered.sort((a, b) => {
            const an = orderIndex(a.networkId);
            const bn = orderIndex(b.networkId);
            if (an !== bn) return an - bn;
            return String(a.symbol).localeCompare(String(b.symbol));
        });

        return filtered;
    }, [registryData, query, network]);

    // Compute enabled map from chain-only walletRegistryStore.data
    const enabled = useMemo(() => {
        const res = {};
        if (!rows.length) return res;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r.type === 'native') {
                res[r.id] = true;
                continue;
            }
            const chainKeyOrName = CHAIN_ID_TO_FAMILY[r.networkChainKey] || r.networkChainKey; // 'ethereum' or '1'
            const list = walletRegistryData?.[chainKeyOrName] || [];
            const addr = r.address?.toLowerCase?.();
            res[r.id] = Array.isArray(list) && !!list.find(t => t.address?.toLowerCase?.() === addr);
        }
        return res;
    }, [rows, walletRegistryData]);

    // Toggle handler: walletStore.addToken/removeToken
    const onToggle = useCallback(async (item, v) => {
        if (item.type === 'native') return;
        const chainName = CHAIN_ID_TO_FAMILY[item.networkChainKey] || item.networkId;
        const walletAddress = walletStore.getWalletAddressByChain(chainName);
        const tokenMeta = {
            address: item.address,
            symbol: item.symbol,
            decimals: Number(item.decimals ?? 18),
            label: item.name || item.symbol,
            chainId: Number.isFinite(+item.networkChainKey) ? +item.networkChainKey : undefined,
            logoUrl: item.logo,
        };
        try {
            if (v) {
                await walletStore.addToken(chainName, walletAddress, tokenMeta);
            } else {
                await walletStore.removeToken(chainName, item.address);
            }
        } catch (e) {
            log.warn('useManageCrypto.onToggle failed', { message: e?.message });
            throw e;
        }
    }, []);
    return {
      status,
      query,
      setQuery,
      network,
      setNetwork,
      rows,
      enabled,
      onToggle,
      networkTags: CHAIN_TAGS,
    };
}
