// src/features/wallet/service/walletRegistryService.js
import { db } from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';
import stockSolana from '@src/features/tokens/registry/json/stock-solana.json';
import forexSolana from '@src/features/tokens/registry/json/forex-solana.json';
import solanaTokens from '@src/features/tokens/registry/json/solona.json';
import slxTokens from '@src/features/tokens/registry/json/slx.json';

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
    { chainId: 1, symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, label: 'Tether USD' },
  ],
};

/* ------------------------------------------------------------------
 * Defaults by chain name (including Solana with stock/forex)
 * NOTE: Will be built lazily after normalizeToken is defined
 * ------------------------------------------------------------------ */
let _DEFAULTS_BY_CHAIN = null;

function getDefaultsByChain() {
  if (_DEFAULTS_BY_CHAIN) return _DEFAULTS_BY_CHAIN;

  _DEFAULTS_BY_CHAIN = {
    '1': (DEFAULT_TOKEN_CATALOG[1] || []).map(t => normalizeToken(t, '1')),
    '56': (DEFAULT_TOKEN_CATALOG[56] || []).map(t => normalizeToken(t, '56')),
    '137': (DEFAULT_TOKEN_CATALOG[137] || []).map(t => normalizeToken(t, '137')),
    '781234': (slxTokens || []).map(t => normalizeToken(t, '781234')),
    'ethereum': (DEFAULT_TOKEN_CATALOG[1] || []).map(t => normalizeToken(t, 'ethereum')),
    'bsc': (DEFAULT_TOKEN_CATALOG[56] || []).map(t => normalizeToken(t, 'bsc')),
    'polygon': (DEFAULT_TOKEN_CATALOG[137] || []).map(t => normalizeToken(t, 'polygon')),
    'slx': (slxTokens || []).map(t => normalizeToken(t, 'slx')),
    'solana': [
      ...(solanaTokens || []).map(t => normalizeToken(t, 'solana')),
      ...(stockSolana || []).map(t => normalizeToken(t, 'solana')),
      ...(forexSolana || []).map(t => normalizeToken(t, 'solana')),
    ],
  };

  return _DEFAULTS_BY_CHAIN;
}

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
  slx: 781234,
};

function toChainKey(chain) {
  return typeof chain === 'number' ? String(chain) : String(chain || '').toLowerCase();
}

/** Normalize token to consistent shape */
function normalizeToken(t = {}, chainKey) {
  const address = t.address || t.contractAddress || t.mintAddress || t.mint || null;
  const symbol = (t.symbol || '').toUpperCase();
  const decimals = Number.isFinite(Number(t.decimals)) ? Number(t.decimals) : 18;
  const ck = toChainKey(t.chainId ?? chainKey);
  const id = `${ck}:${symbol}:${address || ''}`.toLowerCase();

  return {
    id,
    chainId: ck,
    symbol,
    address,
    decimals,
    name: t.name || t.label || symbol || '',
    label: t.label || null,
    logo: t.logo || t.logoUrl || t.logoURI || null,
    type: t.type || 'token', // 'token' | 'stock' | 'forex'
    tag: t.tag || null,      // Keep original tag for Solana X tokens
    chainName: t.chainName || null, // Keep original chainName
    isToken: true,
  };
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
  return exists ? (list || []) : [...(list || []), tokenMeta];
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
      const normalized = normalizeToken(tokenMeta, chain);
      return tokenDoc(chain).patch((cur) => uniqAppend(cur, normalized));
    } catch (e) {
      log.warn('tokenRegistry.add failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },

  /** Add many tokens at once (de-duped) */
  upsertMany(chain, tokens = []) {
    try {
      const ck = toChainKey(chain);
      return tokenDoc(chain).patch((cur) => {
        let next = Array.isArray(cur) ? cur : [];
        for (const t of tokens || []) {
          const normalized = normalizeToken(t, ck);
          next = uniqAppend(next, normalized);
        }
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

  /** Force reload defaults for this chain (useful for debugging) */
  forceReloadDefaults(chain) {
    try {
      const ck = toChainKey(chain);
      // Clear current tokens
      this.reset(chain);
      // Force reload defaults
      const defaults = this.getDefaultsForChain(chain);
      const merged = this.upsertMany(chain, defaults);
      log.info('tokenRegistry.forceReloadDefaults completed', {
        chain: ck,
        count: merged.length,
      });
      return merged;
    } catch (e) {
      log.warn('tokenRegistry.forceReloadDefaults failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },

  /** Get built-in default tokens for this chain */
  getDefaultsForChain(chain) {
    const ck = toChainKey(chain);
    const defaults = getDefaultsByChain();
    return defaults[ck] || [];
  },

  /** Seed default tokens for this chain (safe to call multiple times) */
  seedDefaults(chain) {
    try {
      const ck = toChainKey(chain);
      const current = this.list(chain);
      const defaults = this.getDefaultsForChain(chain);

      console.log(`🌱 seedDefaults(${ck}): Starting...`);
      console.log(`   Current tokens: ${current.length}`);
      console.log(`   Available defaults: ${defaults.length}`);

      if (ck === 'solana' && current.length > 0) {
        console.log(`   Current token symbols:`, current.map(t => t.symbol).join(', '));
      }
      // For solana chain, always ensure we have all defaults (including stock/forex)
      if (ck === 'solana') {
        // Check if we have all default tokens
        const defaultTokenSymbols = ['XUSDT', 'JYB', 'SLX', 'BTC', 'ETH', 'DOGE', 'LTC', 'USDC'];
        const hasAllDefaults = defaultTokenSymbols.every(symbol =>
          current.some(t => t.symbol === symbol)
        );

        const hasStock = current.some(t => t.type === 'stock');
        const hasForex = current.some(t => t.type === 'forex');

        console.log(`   📊 Current state: hasAllDefaults=${hasAllDefaults}, hasStock=${hasStock}, hasForex=${hasForex}`);

        // If missing any defaults, reload all
        if (!hasAllDefaults || !hasStock || !hasForex) {
          console.log('   🔄 Missing tokens, reloading all defaults...');
          const merged = this.upsertMany(chain, defaults);
          log.info('tokenRegistry.seedDefaults reloaded solana defaults', {
            chain: ck,
            count: merged.length,
            stockCount: merged.filter(t => t.type === 'stock').length,
            forexCount: merged.filter(t => t.type === 'forex').length,
            defaultTokens: merged.filter(t => defaultTokenSymbols.includes(t.symbol)).length,
          });
          console.log(`   ✅ Reloaded ${merged.length} tokens total`);
          return merged;
        }

        console.log(`   ✅ Solana tokens already complete: ${current.length} tokens`);
        return current;
      }

      // For other chains, use original logic
      // For SLX chain, always ensure MEX default token is present
      if (ck === 'slx') {
        const hasMEX = current.some(t => t.symbol === 'MEX');
        if (!hasMEX && defaults.length > 0) {
          console.log('   🔄 SLX missing MEX token, seeding defaults...');
          const merged = this.upsertMany(chain, defaults);
          console.log(`   ✅ SLX seeded ${merged.length} tokens`);
          return merged;
        }
        if (current.length > 0) return current;
      }

      if (current.length > 0) return current;
      if (!defaults.length) return current;
      const merged = this.upsertMany(chain, defaults);
      log.info('tokenRegistry.seedDefaults ok', {
        chain: ck,
        count: merged.length,
      });
      return merged;
    } catch (e) {
      log.warn('tokenRegistry.seedDefaults failed', { chain, message: e?.message });
      return this.list(chain);
    }
  },
};
