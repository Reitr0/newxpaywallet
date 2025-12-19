// src/features/trending/state/trendingStore.js
import { proxy } from 'valtio';
import { createMMKV } from '@src/shared/infra/storage/storageService';
import { http } from '@src/shared/infra/http/httpClient'; // assumes default export with .get
const BASE_URL = 'https://vprice-68e717fd25a6.herokuapp.com'; // adjust if needed

// === Cache (MMKV) ================================================
const mmkv = createMMKV('trending-storage');
const MMKV_KEY = 'trending.cache.v1';
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const loadCache = () => mmkv.getItem(MMKV_KEY, {}) || {};
const saveCache = (obj) => mmkv.setItem(MMKV_KEY, obj);

function makeKey(chain, window) {
  return `${chain}|${window}`;
}

// === Store =======================================================
export const trendingStore = proxy({
  filters: {
    chain: 'all',   // 'all' | 'bitcoin' | 'ethereum' | etc.
    window: '24h',  // '24h' | '7d' | '30d'
  },
  entities: [],
  status: 'idle',   // 'idle' | 'loading' | 'ready' | 'error'
  error: null,
  lastUpdated: 0,

  // Internal: dedupe map
  _inflight: {},

  setFilters(partial) {
    trendingStore.filters = { ...trendingStore.filters, ...partial };
  },
  setList(items) {
    trendingStore.entities = items;
    trendingStore.status = 'ready';
    trendingStore.error = null;
    trendingStore.lastUpdated = Date.now();
  },
  setLoading() {
    trendingStore.status = 'loading';
    trendingStore.error = null;
  },
  setError(msg) {
    trendingStore.status = 'error';
    trendingStore.error = msg || 'Unknown error';
  },
});

// === HTTP fetch via shared client ================================
async function fetchTrendingFromAPI(chain, window) {
  // Assuming http has baseURL configured; only pass the path + params
  // and returns { data: [...] } like axios.
  const res = await http.get(`${BASE_URL}/api/v1/tokens/trending`, {
    params: { limit: 100, chain, window },
    headers: { Accept: 'application/json' },
  });

  const arr = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  if (!Array.isArray(arr)) return [];

  const chainKeyFromId = (cid) => {
    if (cid == null) return chain || 'all';
    switch (Number(cid)) {
      case 0:  return 'bitcoin';
      case 1:  return 'ethereum';
      default: return String(cid);
    }
  };

  return arr.map((it, i) => {
    const price     = Number(it.currentPrice ?? 0);
    const changePct = Number(it.priceChangePercentage24h ?? 0);
    const volume    = Number(it.totalVolume ?? 0);

    const id =
      it._id ||
      `${(it.symbol || 'token').toUpperCase()}::${it.chainId ?? 'all'}::${it.address ?? 'native'}::${i}`;

    return {
      id,
      symbol: (it.symbol || '').toUpperCase(),
      name: it.name || it.symbol || 'Unknown',
      priceUsd: Number.isFinite(price) ? price : 0,
      changePct: Number.isFinite(changePct) ? changePct : 0,
      volumeUsd: Number.isFinite(volume) ? volume : 0,
      logoUrl: it.image || null,

      // extras for UI rows
      chain: chainKeyFromId(it.chainId),
      address: it.address || null,
      marketCap: Number(it.marketCap ?? 0),
      high24h: Number(it.high24h ?? 0),
      low24h: Number(it.low24h ?? 0),
      rank: it.marketCapRank ?? null,
      lastUpdated: it.lastUpdated?.$date || it.lastUpdated || null,
    };
  });
}

// === Cache + dedupe =============================================
export async function loadTrending(options = {}) {
  const { blocking = false } = options;
  const { chain, window } = trendingStore.filters;
  const key = makeKey(chain, window);

  // 1) Serve fresh cache instantly if present
  const cache = loadCache();
  const cached = cache[key];
  const now = Date.now();

  if (cached && now - (cached.ts || 0) < CACHE_TTL_MS) {
    trendingStore.setList(cached.items || []);
    if (!blocking) {
      void refreshTrending(chain, window, key, cache);
      return;
    }
  }

  // 2) Otherwise block until fresh data
  await refreshTrending(chain, window, key, cache, { setLoading: true });
}

async function refreshTrending(chain, window, key, cache, opts = {}) {
  if (!trendingStore._inflight[key]) {
    trendingStore._inflight[key] = (async () => {
      try {
        if (opts.setLoading) trendingStore.setLoading();

        const items = await fetchTrendingFromAPI(chain, window);
        trendingStore.setList(items);

        const next = { ...(cache || loadCache()) };
        next[key] = { ts: Date.now(), items };
        saveCache(next);
      } catch (e) {
        trendingStore.setError(e?.message || 'Failed to load trending');
      } finally {
        delete trendingStore._inflight[key];
      }
    })();
  }
  return trendingStore._inflight[key];
}

// === Helpers =====================================================
export async function refreshTrendingNow() {
  const { chain, window } = trendingStore.filters;
  const key = makeKey(chain, window);
  await refreshTrending(chain, window, key, loadCache(), { setLoading: true });
}

export function setTrendingList(items = []) {
  trendingStore.setList(items);
}

