import {createHttpClient} from '@src/shared/infra/http/httpClient';
import { ENV } from '@src/shared/config/env/env';

const zeroEx = createHttpClient({
  baseURL: ENV.ZEROEX_API_URL,
  name: "zeroEx",
  retries: 3,
  headers: {
    '0x-api-key': ENV.ZEROEX_API_KEY,
    '0x-version': ENV.ZEROEX_API_VERSION,
    'Accept': 'application/json',
  },
});

export default zeroEx;
