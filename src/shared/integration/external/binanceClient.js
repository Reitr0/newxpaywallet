import {createHttpClient} from '@src/shared/infra/http/httpClient';
const binance = createHttpClient({
  baseURL: "https://api.binance.com",
  name: "binance",
  retries: 3,
});

export default binance;
