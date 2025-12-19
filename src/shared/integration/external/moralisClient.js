// src/shared/infra/http/clients/moralisClient.js
import {createHttpClient} from '@src/shared/infra/http/httpClient';
import { ENV } from '@src/shared/config/env/env';


const moralis = createHttpClient({
  baseURL: ENV.MORALIS_API_URL,
  name: 'moralis',
  retries: 2,
});

// Attach API key automatically
moralis.interceptors.request.use(cfg => {
  if (ENV.MORALIS_API_KEY) {
    cfg.headers = {
      ...(cfg.headers || {}),
      'X-API-Key': ENV.MORALIS_API_KEY,
    };
  }
  return cfg;
});

export default moralis;

