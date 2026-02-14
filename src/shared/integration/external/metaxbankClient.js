// src/shared/integration/external/metaxbankClient.js
import { createHttpClient } from '@src/shared/infra/http/httpClient';

/**
 * MetaxBank API Client
 * Used to fetch JYB (Jin Yuan Bao / MX Gold) price
 * API: https://account.metaxbank.io/api/mx-gold-price
 */
const metaxbankClient = createHttpClient({
  baseURL: 'https://account.metaxbank.io',
  name: 'metaxbank',
  timeout: 10000,
  retries: 2,
  defaultCacheTtl: 30000, // cache for 30 seconds
});

/**
 * Fetch JYB/MX Gold price from MetaxBank API
 * @returns {Promise<{price: number, priceChangePercent: number}>}
 */
export async function fetchJYBPrice() {
  try {
    const { data } = await metaxbankClient.get('/api/mx-gold-price');
    
    // Expected response format: { price: number, ... }
    // Adjust parsing based on actual API response
    let price = 0;
    let priceChangePercent = 0;
    
    if (data) {
      // Handle different response formats
      if (typeof data === 'number') {
        price = data;
      } else if (typeof data === 'object') {
        // Try common field names
        price = data.price ?? data.usd ?? data.value ?? data.rate ?? data.mx_gold_price ?? 0;
        priceChangePercent = data.priceChangePercent ?? data.change ?? data.change_24h ?? data.percent_change ?? 0;
      }
    }
    
    console.log('[metaxbankClient] JYB price fetched:', { price, priceChangePercent, rawData: data });
    
    return {
      price: Number(price) || 0,
      priceChangePercent: Number(priceChangePercent) || 0,
    };
  } catch (error) {
    console.error('[metaxbankClient] Failed to fetch JYB price:', error.message);
    throw error;
  }
}

export default metaxbankClient;
