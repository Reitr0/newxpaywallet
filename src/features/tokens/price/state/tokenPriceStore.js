// src/shared/tokens/tokenPriceStore.js
import { proxy } from 'valtio';
import { http } from '@src/shared/infra/http/httpClient';
import log from '@src/shared/infra/log/logService';

/**
 * Super-simple Binance price store
 * - Fetches ALL pairs from Binance: https://api.binance.com/api/v3/ticker/price
 * - Stores as a flat map: { [PAIR]: { symbol: 'BTCUSDT', price: number, updatedAt: number } }
 * - No legacy logic, no wallet coupling, no MMKV persistence (you can add later if needed)
 */

const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/24hr';

// tiny helpers
const toNum = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const toPair = (s) => String(s || '').toUpperCase();

export const tokenPriceStore = proxy({
  status: 'idle',   // 'idle' | 'loading' | 'ready' | 'error'
  error: null,
  prices: {},        // { 'BTCUSDT': { symbol, price, updatedAt }, ... }

  /** Replace entire map at once */
  _replaceAll(map) {
    this.prices = map || {};
  },

  /** Fetch ALL tickers from Binance and map by PAIR -> data */
  async fetchAll() {
    try {
      this.status = 'loading';
      this.error = null;

      const { data } = await http.get(BINANCE_URL);
      if (!Array.isArray(data)) throw new Error('Invalid Binance payload');

      // Build new map
      const now = Date.now();
      const out = Object.create(null);
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // Binance row: { symbol: 'BTCUSDT', price: '68123.45' }
        const pair = toPair(row?.symbol);
        if (!pair) continue;

        out[pair] = {
          symbol: pair,
          price: toNum(row?.lastPrice),
          priceChangePercent: toNum(row?.priceChangePercent), // 24h change %
          volume: toNum(row?.volume),                         // 24h volume in base asset
          quoteVolume: toNum(row?.quoteVolume),               // 24h volume in quote asset
          highPrice: toNum(row?.highPrice),                   // 24h high price
          lowPrice: toNum(row?.lowPrice),                     // 24h low price
          openPrice: toNum(row?.openPrice),                   // 24h open price
          lastPrice: toNum(row?.lastPrice),
          updatedAt: now,
        };
      }
      this._replaceAll(out);
      this.status = 'ready';
      log.info('tokenPriceStore.fetchAll ok', { pairs: Object.keys(out).length });
      return out;
    } catch (e) {
      this.status = 'error';
      this.error = e?.message || 'Failed to fetch Binance prices';
      log.warn('tokenPriceStore.fetchAll failed', { message: this.error });
      throw e;
    }
  },

  /** Get one pair (e.g., 'ETHUSDT') */
  get(pair) {
    return this.pairs[toPair(pair)] || null;
  },

  /** Get price number for a pair (or 0 if missing) */
  getPrice(pair) {
    const row = this.get(pair);
    return row ? row.price : 0;
  },

  /** Return shallow list of all pairs */
  list() {
    return Object.values(this.pairs);
  },
});
