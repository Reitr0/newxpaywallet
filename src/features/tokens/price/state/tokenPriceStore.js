// src/shared/tokens/tokenPriceStore.js
import { proxy } from 'valtio';
import binance from '@src/shared/integration/external/binanceClient';
import { coingecko } from '@src/shared/integration/external/coingeckoClient';
import log from '@src/shared/infra/log/logService';

/**
 * Super-simple Binance price store
 * - Fetches ALL pairs from Binance: https://api.binance.com/api/v3/ticker/price
 * - Stores as a flat map: { [PAIR]: { symbol: 'BTCUSDT', price: number, updatedAt: number } }
 * - Falls back to CoinGecko if Binance fails
 */

const BINANCE_ENDPOINT = '/api/v3/ticker/24hr';

// CoinGecko ID mapping for major coins
const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  TRX: 'tron',
};

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

      console.log('[tokenPriceStore] Fetching prices from Binance...');
      const { data } = await binance.get(BINANCE_ENDPOINT);
      
      if (!Array.isArray(data)) {
        console.error('[tokenPriceStore] Invalid response:', typeof data, data);
        throw new Error('Invalid Binance payload');
      }

      console.log('[tokenPriceStore] Received', data.length, 'pairs from Binance');

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
      await this.fetchStockForexPrices(); // Fetch real stock/forex prices
      this.status = 'ready';
      
      // Log some sample prices for debugging
      console.log('[tokenPriceStore] Sample prices:', {
        BTCUSDT: out['BTCUSDT']?.price,
        ETHUSDT: out['ETHUSDT']?.price,
        BNBUSDT: out['BNBUSDT']?.price,
      });
      
      log.info('tokenPriceStore.fetchAll ok', { pairs: Object.keys(out).length });
      return out;
    } catch (e) {
      console.error('[tokenPriceStore] Binance fetchAll failed:', e.message);
      log.warn('tokenPriceStore.fetchAll failed, trying CoinGecko fallback', { message: e.message });
      
      // Try CoinGecko fallback
      try {
        return await this.fetchFromCoinGecko();
      } catch (cgError) {
        this.status = 'error';
        this.error = e?.message || 'Failed to fetch prices';
        console.error('[tokenPriceStore] CoinGecko fallback also failed:', cgError.message);
        throw e;
      }
    }
  },

  /** Fallback: Fetch prices from CoinGecko */
  async fetchFromCoinGecko() {
    console.log('[tokenPriceStore] Trying CoinGecko fallback...');
    
    const ids = Object.values(COINGECKO_IDS).join(',');
    const { data } = await coingecko.get('/simple/price', {
      params: {
        ids,
        vs_currencies: 'usd',
        include_24hr_change: true,
      }
    });
    
    console.log('[tokenPriceStore] CoinGecko response:', data);
    
    const now = Date.now();
    const out = Object.create(null);
    
    // Map CoinGecko response to Binance-like format
    for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
      const cgData = data[cgId];
      if (cgData) {
        const pair = symbol + 'USDT';
        out[pair] = {
          symbol: pair,
          price: toNum(cgData.usd),
          priceChangePercent: toNum(cgData.usd_24h_change),
          lastPrice: toNum(cgData.usd),
          updatedAt: now,
        };
      }
    }
    
    // Add stablecoin pairs using actual CoinGecko data
    const tetherPrice = toNum(data['tether']?.usd) || 1;
    const usdcPrice = toNum(data['usd-coin']?.usd) || 1;
    const daiPrice = toNum(data['dai']?.usd) || 1;
    
    // XUSDT price - use tether price directly
    out['XUSDTUSDT'] = { 
      symbol: 'XUSDTUSDT', 
      price: tetherPrice, 
      lastPrice: tetherPrice, 
      priceChangePercent: toNum(data['tether']?.usd_24h_change),
      updatedAt: now 
    };
    
    // USDTUSDT - main USDT price pair (used by XUSDT and other USDT tokens)
    out['USDTUSDT'] = { 
      symbol: 'USDTUSDT', 
      price: tetherPrice, 
      lastPrice: tetherPrice, 
      priceChangePercent: toNum(data['tether']?.usd_24h_change),
      updatedAt: now 
    };
    out['USDTDAI'] = { 
      symbol: 'USDTDAI', 
      price: tetherPrice, 
      lastPrice: tetherPrice, 
      priceChangePercent: toNum(data['tether']?.usd_24h_change),
      updatedAt: now 
    };
    out['USDCUSDT'] = { 
      symbol: 'USDCUSDT', 
      price: usdcPrice, 
      lastPrice: usdcPrice, 
      priceChangePercent: toNum(data['usd-coin']?.usd_24h_change),
      updatedAt: now 
    };
    out['DAIUSDT'] = { 
      symbol: 'DAIUSDT', 
      price: daiPrice, 
      lastPrice: daiPrice, 
      priceChangePercent: toNum(data['dai']?.usd_24h_change),
      updatedAt: now 
    };
    
    console.log('[tokenPriceStore] Added XUSDTUSDT price:', tetherPrice);
    
    this._replaceAll(out);
    await this.fetchStockForexPrices(); // Fetch real stock/forex prices
    this.status = 'ready';
    
    console.log('[tokenPriceStore] CoinGecko fallback success, pairs:', Object.keys(out).length);
    log.info('tokenPriceStore.fetchFromCoinGecko ok', { pairs: Object.keys(out).length });
    
    return out;
  },

  /** Get one pair (e.g., 'ETHUSDT') */
  get(pair) {
    return this.prices[toPair(pair)] || null;
  },

  /** Get price number for a pair (or 0 if missing) */
  getPrice(pair) {
    const row = this.get(pair);
    return row ? row.price : 0;
  },

  /** Return shallow list of all pairs */
  list() {
    return Object.values(this.prices);
  },

  /** Fetch real stock and forex prices from Financial Modeling Prep API */
  async fetchStockForexPrices() {
    const now = Date.now();
    const apiKey = 'HHHJjGF5VPCVixV3imPFxO4ZeaqGSH8U';
    
    try {
      const stockSymbols = ['AMZN', 'GOOG', 'TSLA', 'AAPL'];
      const stockPrices = {};
      
      // Fetch JYB price from MetaxBank API
      try {
        console.log('[tokenPriceStore] Fetching JYB from MetaxBank API...');
        const jybResponse = await fetch('https://account.metaxbank.io/api/mx-gold-price');
        const jybText = await jybResponse.text(); // API returns plain number, not JSON
        
        console.log('[tokenPriceStore] JYB response (raw):', jybText);
        
        const jybPrice = parseFloat(jybText);
        
        if (!isNaN(jybPrice) && jybPrice > 0) {
          stockPrices['JYBUSDT'] = {
            symbol: 'JYBUSDT',
            price: jybPrice,
            priceChangePercent: 0, // API doesn't provide change %
            updatedAt: now,
          };
          console.log(`[tokenPriceStore] JYB price: $${jybPrice}`);
        } else {
          console.warn('[tokenPriceStore] JYB - invalid price:', jybText);
        }
      } catch (err) {
        console.warn('[tokenPriceStore] Failed to fetch JYB:', err.message);
      }
      
      // Fetch all stock prices
      for (const symbol of stockSymbols) {
        try {
          const url = `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${apiKey}`;
          console.log(`[tokenPriceStore] Fetching ${symbol} from:`, url);
          
          const response = await fetch(url);
          const data = await response.json();
          
          console.log(`[tokenPriceStore] ${symbol} response:`, JSON.stringify(data));
          
          if (Array.isArray(data) && data.length > 0) {
            const quote = data[0];
            stockPrices[`${symbol}USDT`] = {
              symbol: `${symbol}USDT`,
              price: quote.price || 0,
              priceChangePercent: quote.changesPercentage || 0,
              updatedAt: now,
            };
            console.log(`[tokenPriceStore] ${symbol} price: $${quote.price}`);
          } else {
            console.warn(`[tokenPriceStore] ${symbol} - unexpected response format`);
          }
        } catch (err) {
          console.warn(`[tokenPriceStore] Failed to fetch ${symbol}:`, err.message);
        }
      }
      
      // Fetch CNY/USD forex rate from Financial Modeling Prep
      try {
        const forexUrl = `https://financialmodelingprep.com/stable/quote?symbol=CNYUSD&apikey=${apiKey}`;
        console.log('[tokenPriceStore] Fetching CNYUSD from:', forexUrl);
        
        const forexResponse = await fetch(forexUrl);
        const forexData = await forexResponse.json();
        
        console.log('[tokenPriceStore] CNYUSD response:', JSON.stringify(forexData));
        
        if (Array.isArray(forexData) && forexData.length > 0) {
          const quote = forexData[0];
          stockPrices['CNYUSDUSDT'] = {
            symbol: 'CNYUSDUSDT',
            price: quote.price || 0,
            priceChangePercent: quote.changesPercentage || 0,
            updatedAt: now,
          };
          console.log(`[tokenPriceStore] CNYUSD price: $${quote.price}`);
        } else {
          console.warn('[tokenPriceStore] CNYUSD - unexpected response format');
        }
      } catch (err) {
        console.warn('[tokenPriceStore] Failed to fetch CNYUSD:', err.message);
      }
      
      // Merge with existing prices
      this.prices = {
        ...this.prices,
        ...stockPrices,
      };
      
      console.log('[tokenPriceStore] Stock/forex prices fetched:', Object.keys(stockPrices));
    } catch (e) {
      console.error('[tokenPriceStore] fetchStockForexPrices failed:', e.message);
    }
  },
});
