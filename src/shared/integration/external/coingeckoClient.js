import {createHttpClient} from '@src/shared/infra/http/httpClient';
const coingecko = createHttpClient({
  baseURL: "https://api.coingecko.com/api/v3",
  name: "coingecko",
  retries: 2,
});

// If you use a key:
// coingecko.interceptors.request.use(cfg => {
//   if (ENV.COINGECKO_API_KEY) {
//     cfg.headers = { ...(cfg.headers||{}), 'x-cg-pro-api-key': ENV.COINGECKO_API_KEY };
//   }
//   return cfg;
// });

module.exports = { coingecko };
