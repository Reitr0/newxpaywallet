// src/shared/infra/http/clients/tronClient.js
import { createHttpClient } from '@src/shared/infra/http/httpClient';
import { ENV } from '@src/shared/config/env/env';

/**
 * TronGrid API client
 * Base URL: https://api.trongrid.io (mainnet)
 * Docs: https://developers.tron.network/reference
 */
const tronClient = createHttpClient({
  baseURL: ENV.TRON_API_URL || 'https://api.trongrid.io',
  name: 'tron',
  retries: 2,
  timeout: 15000,
});

// Automatically attach TRON-PRO-API-KEY if available
tronClient.interceptors.request.use(cfg => {
  if (ENV.TRON_API_KEY) {
    cfg.headers = {
      ...(cfg.headers || {}),
      'TRON-PRO-API-KEY': ENV.TRON_API_KEY,
    };
  }
  return cfg;
});

export default tronClient;
