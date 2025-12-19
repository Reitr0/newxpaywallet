import {createHttpClient} from '@src/shared/infra/http/httpClient';
import { ENV } from '@src/shared/config/env/env';


const vServer = createHttpClient({
  baseURL: ENV.API_BASE_URL,
  name: "v",
  retries: 3,
  defaultCacheTtl: 0,
});

// Attach auth once for all features
vServer.interceptors.request.use((cfg) => {
  try {
    const token = 'ABC';
    if (token) cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
  } catch {}
  return cfg;
});

export default vServer;
