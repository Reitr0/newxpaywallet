// src/features/tokens/registry/service/tokenRegistryService.js
import { db } from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

// Static lists (bundled)
import erc20 from '@src/features/tokens/registry/json/erc20.json';
import bep20 from '@src/features/tokens/registry/json/bep20.json';
import polygon from '@src/features/tokens/registry/json/polygon.json';
import solanaL from '@src/features/tokens/registry/json/solona.json';
import trc20 from '@src/features/tokens/registry/json/trc20.json';

/* ------------------------------- helpers -------------------------------- */

function toChainKey(chainId) {
  return typeof chainId === 'number' ? String(chainId) : String(chainId || '').toLowerCase();
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function parseId(id) {
  // id = "<chainKey>:<SYMBOL>:<address>"
  if (!id) return null;
  const parts = String(id).split(':');
  if (parts.length < 2) return null;
  if (parts.length === 2) {
    const [chainKey, symbol] = parts;
    return { chainKey, symbol, address: null };
  }
  const [chainKey, symbol, ...rest] = parts;
  const address = rest.join(':'); // in case address has colons (unlikely)
  return { chainKey, symbol, address };
}

function makeId(chainKey, symbol, address) {
  const sym = String(symbol || '').toUpperCase();
  if (!address) return `${chainKey}:${sym}`.toLowerCase();
  return `${chainKey}:${sym}:${String(address)}`.toLowerCase();
}

/** Normalize any token object to a consistent shape (+ id) */
function normalizeToken(t = {}, chainKey) {
  const address =
    t.address ||
    t.contractAddress ||
    t.mintAddress ||
    t.mint ||
    null;

  const symbol = (t.symbol || '').toUpperCase();

  const decimalsRaw =
    t.decimals ??
    t.tokenDecimals ??
    (typeof t.decimals === 'string' ? Number(t.decimals) : undefined);

  const decimals = Number.isFinite(Number(decimalsRaw))
    ? Number(decimalsRaw)
    : 18;

  const ck = toChainKey(t.chainId ?? chainKey);
  const id = makeId(ck, symbol, address);

  return {
    id,                      // <-- canonical id
    chainId: ck,             // store as string: "1" | "56" | "polygon" | "solana" | "tron"
    symbol,
    address,                 // null for native (rare in registry)
    decimals,
    name: t.name || t.label || symbol || '',
    logo: t.logo || t.logoUrl || null,
    isToken: true
  };
}

/** De-dup by id. Last one wins (prefer user edit). */
function dedupeById(list) {
  const map = new Map(); // id -> token
  for (const t of list || []) {
    if (!t?.id) continue;
    map.set(String(t.id).toLowerCase(), t);
  }
  return Array.from(map.values());
}

/* -------------------------- defaults per chain --------------------------- */

const DEFAULTS_BY_CHAIN = {
  '1':      (erc20   || []).map(x => normalizeToken(x, '1')),
  '56':     (bep20   || []).map(x => normalizeToken(x, '56')),
  '137':    (polygon || []).map(x => normalizeToken(x, '137')),
  'solana': (solanaL || []).map(x => normalizeToken(x, 'solana')),
  'tron':   (trc20   || []).map(x => normalizeToken(x, 'tron')),
};

/* ------------------------------- storage -------------------------------- */

function chainDoc(chainId) {
  const chainKey = toChainKey(chainId);
  const defaults = DEFAULTS_BY_CHAIN[chainKey] || [];

  return db.doc(`tokenRegistry.${chainKey}.v1`, {
    defaults, // NOTE: defaults are not written; used only in decode merge

    decode: (raw) => {
      const user = Array.isArray(raw) ? raw : [];
      // Normalize user entries first
      const userNorm = user.map(t => normalizeToken(t, chainKey));
      // Merge defaults (base) + user (override). Dedup by id (user wins).
      return dedupeById([ ...(defaults || []), ...userNorm ]);
    },

    // Persist ONLY user-managed entries; defaults live in code.
    encode: (val) => (Array.isArray(val) ? val : []),
  });
}

/* --------------------------------- API ---------------------------------- */

export const tokenRegistryService = {
  /** List merged tokens (defaults + user) for a chain. Each entry has `id`. */
  list(chainId) {
    try {
      return chainDoc(chainId).get();
    } catch (e) {
      log.warn('tokenRegistry.list failed', { chainId, message: e?.message });
      return DEFAULTS_BY_CHAIN[toChainKey(chainId)] || [];
    }
  },

  /** Replace user list for a chain (defaults are not overwritten). */
  set(chainId, tokens = []) {
    try {
      const chainKey = toChainKey(chainId);
      const normalized = (tokens || []).map(t => normalizeToken(t, chainKey));
      return chainDoc(chainId).set(normalized);
    } catch (e) {
      log.warn('tokenRegistry.set failed', { chainId, message: e?.message });
      return this.list(chainId);
    }
  },

  /** Add/Upsert a token (by object with id/address OR by id string). */
  add(chainId, tokenOrId) {
    try {
      const doc = chainDoc(chainId);
      const chainKey = toChainKey(chainId);
      const merged = doc.get(); // merged view now
      const defaults = DEFAULTS_BY_CHAIN[chainKey] || [];

      // Resolve incoming token meta
      let tNew;
      if (typeof tokenOrId === 'string') {
        const parsed = parseId(tokenOrId);
        if (!parsed?.address) return merged;
        tNew = normalizeToken(
          { chainId: chainKey, symbol: parsed.symbol, address: parsed.address },
          chainKey
        );
      } else {
        tNew = normalizeToken(tokenOrId, chainKey);
      }
      if (!tNew?.address) return merged;

      // Is it in defaults?
      const inDefaults = defaults.some(d => d.id === tNew.id);

      // userOnly = merged - defaults
      const userOnly = merged.filter(x => !defaults.some(d => d.id === x.id));

      // Upsert by id
      const idx = userOnly.findIndex(x => x.id === tNew.id);
      if (idx >= 0) userOnly[idx] = { ...userOnly[idx], ...tNew };
      else if (!inDefaults) userOnly.push(tNew); // if default exists, no need to store unless overriding

      return doc.set(userOnly);
    } catch (e) {
      log.warn('tokenRegistry.add failed', { chainId, message: e?.message });
      return this.list(chainId);
    }
  },

  /** Alias for add */
  upsert(chainId, tokenOrId) {
    return this.add(chainId, tokenOrId);
  },

  /** Remove by `id` ("chain:symbol:address") OR by raw contract/mint address. */
  remove(chainId, idOrAddress) {
    try {
      const chainKey = toChainKey(chainId);
      const doc = chainDoc(chainId);
      const merged = doc.get();
      const defaults = DEFAULTS_BY_CHAIN[chainKey] || [];

      let targetId = null;
      let targetAddr = null;

      if (typeof idOrAddress === 'string' && idOrAddress.includes(':')) {
        const p = parseId(idOrAddress);
        targetId = p?.address ? makeId(chainKey, p.symbol, p.address) : null;
        targetAddr = p?.address?.toLowerCase?.() || null;
      } else if (typeof idOrAddress === 'string') {
        targetAddr = idOrAddress.toLowerCase();
      } else if (idOrAddress?.address) {
        targetAddr = String(idOrAddress.address).toLowerCase();
      }

      if (!targetId && !targetAddr) return merged;

      // userOnly = merged - defaults
      const userOnly = merged.filter(x => !defaults.some(d => d.id === x.id));

      const nextUser = userOnly.filter(x => {
        if (targetId) return x.id !== targetId;
        return !sameAddress(x.address, targetAddr);
      });

      return doc.set(nextUser);
    } catch (e) {
      log.warn('tokenRegistry.remove failed', { chainId, message: e?.message });
      return this.list(chainId);
    }
  },

  /** Reset user list (keeps defaults). */
  reset(chainId) {
    try {
      return chainDoc(chainId).reset();
    } catch (e) {
      log.warn('tokenRegistry.reset failed', { chainId, message: e?.message });
      return this.list(chainId);
    }
  },

  /** Lookups */
  findById(id) {
    const p = parseId(id);
    if (!p?.chainKey) return null;
    const list = this.list(p.chainKey);
    return list.find(t => t.id === makeId(p.chainKey, p.symbol, p.address)) || null;
  },

  findByAddress(chainId, address) {
    if (!address) return null;
    const list = this.list(chainId);
    const addr = String(address).toLowerCase();
    return list.find(t => sameAddress(t.address, addr)) || null;
  },

  findBySymbol(chainId, symbol) {
    if (!symbol) return null;
    const list = this.list(chainId);
    const sym = String(symbol).toUpperCase();
    return list.find(t => (t.symbol || '').toUpperCase() === sym) || null;
  },

  /** Available chains (keys of defaults) */
  chains() {
    return Object.keys(DEFAULTS_BY_CHAIN);
  },
};
