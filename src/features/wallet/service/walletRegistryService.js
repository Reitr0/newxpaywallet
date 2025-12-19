// src/features/wallet/service/walletRegistryService.js
import { db } from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

/**
 * Token metadata shape (per chain):
 * { address: string, symbol: string, decimals: number, name?: string, label?: string, logoUrl?: string, chainId?: number }
 */

const DEFAULT_TOKENS_EMPTY = [];

/* ------------------------------------------------------------------
 * Built-in catalog (by EVM chainId)
 * ------------------------------------------------------------------ */
const DEFAULT_TOKEN_CATALOG = {
  1: [
    { chainId: 1,  symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  label: 'Tether USD' },
    { chainId: 1,  symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  label: 'USD Coin' },
    { chainId: 1,  symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, label: 'Dai Stablecoin' },
  ],
  56: [
    { chainId: 56, symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, label: 'Tether USD' },
    { chainId: 56, symbol: 'BUSD', address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', decimals: 18, label: 'BUSD' },
  ],
  137: [
    { chainId: 137, symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, label: 'USD Coin (PoS)' },
  ],
};

/* ------------------------------------------------------------------
 * Chain ID helpers
 * ------------------------------------------------------------------ */
const CHAIN_NAME_TO_ID = {
  ethereum: 1,
  eth: 1,
  bsc: 56,
  binance: 56,
  polygon: 137,
  matic: 137,
};

function toChainId(chain) {
  if (typeof chain === 'number' && Number.isFinite(chain)) return chain;
  const key = String(chain || '').toLowerCase();
  return CHAIN_NAME_TO_ID[key] ?? null;
}

function toChainKey(chain) {
  if (typeof chain === 'string') return chain.toLowerCase();
  if (typeof chain === 'number') return String(chain);
  return String(chain || '').toLowerCase();
}

/* ------------------------------------------------------------------
 * Storage doc per chain
 * ------------------------------------------------------------------ */
function tokenDoc(chain) {
  const chainKey = toChainKey(chain);
  const key = `tokens.${chainKey}.v1`;

  return db.doc(key, {
    defaults: DEFAULT_TOKENS_EMPTY,
    decode: (raw) => (Array.isArray(raw) ? raw : []),
    encode: (val) => (Array.isArray(val) ? val : []),
  });
}

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */
function sameAddr(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function uniqAppend(list, tokenMeta) {
  const addr = tokenMeta?.address;
  if (!addr) return list || [];
  const exists = (list || []).some((t) => sameAddr(t?.address, addr));
  return exists ? (list || []) : [ ...(list || []), tokenMeta ];
}

/* ------------------------------------------------------------------
 * Service (CHAIN-ONLY)
 * ------------------------------------------------------------------ */
export const walletRegistryService = {
  /** List all tokens tracked for a chain */
  list(chain) {
    try {
      return tokenDoc(chain).get();
    } catch (e) {
      log.warn('tokenRegistry.list failed', { chain, message: e?.message });
      return [];
    }
  },

  /** Replace all tokens for this chain */
  set(chain, tokens = []) {
    try {
      return tokenDoc(chain).set(Array.isArray(tokens) ? tokens : []);
    } catch (e) {
      log.warn('tokenRegistry.set failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },

  /** Add one token to this chain (de-duped by address) */
  add(chain, tokenMeta) {
    try {
      return tokenDoc(chain).patch((cur) => uniqAppend(cur, tokenMeta));
    } catch (e) {
      log.warn('tokenRegistry.add failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },

  /** Add many tokens at once (de-duped) */
  upsertMany(chain, tokens = []) {
    try {
      return tokenDoc(chain).patch((cur) => {
        let next = Array.isArray(cur) ? cur : [];
        for (const t of tokens || []) next = uniqAppend(next, t);
        return next;
      });
    } catch (e) {
      log.warn('tokenRegistry.upsertMany failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },

  /** Remove a token by address string or predicate */
  remove(chain, tokenAddressOrPredicate) {
    try {
      return tokenDoc(chain).patch((cur) => {
        const list = Array.isArray(cur) ? cur : [];
        if (typeof tokenAddressOrPredicate === 'function') {
          return list.filter((t) => !tokenAddressOrPredicate(t));
        }
        const target = String(tokenAddressOrPredicate || '').toLowerCase();
        return list.filter((t) => !sameAddr(t?.address, target));
      });
    } catch (e) {
      log.warn('tokenRegistry.remove failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },

  /** Reset tokens for this chain */
  reset(chain) {
    try {
      return tokenDoc(chain).reset();
    } catch (e) {
      log.warn('tokenRegistry.reset failed', { chain, message: e?.message });
      return [];
    }
  },

  /** Get built-in default tokens for this chain */
  getDefaultsForChain(chain) {
    const cid = toChainId(chain);
    return cid ? (DEFAULT_TOKEN_CATALOG[cid] || []) : [];
  },

  /** Seed default tokens for this chain (safe to call multiple times) */
  seedDefaults(chain) {
    try {
      const current = this.list(chain);
      if (current.length > 0) return current;
      const defaults = this.getDefaultsForChain(chain);
      if (!defaults.length) return current;
      const merged = this.upsertMany(chain, defaults);
      log.info('tokenRegistry.seedDefaults ok', {
        chain: toChainKey(chain),
        count: merged.length,
      });
      return merged;
    } catch (e) {
      log.warn('tokenRegistry.seedDefaults failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },
};
