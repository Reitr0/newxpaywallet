import { proxy } from 'valtio';

import erc20 from '@src/features/tokens/registry/json/erc20.json';
import bep20 from '@src/features/tokens/registry/json/bep20.json';
import polygon from '@src/features/tokens/registry/json/polygon.json';
import solanaL from '@src/features/tokens/registry/json/solona.json';
import trc20 from '@src/features/tokens/registry/json/trc20.json';
import stockSolana from '@src/features/tokens/registry/json/stock-solana.json';
import forexSolana from '@src/features/tokens/registry/json/forex-solana.json';

const jsonSources = [
  { list: erc20,   network: "ethereum" },
  { list: bep20,   network: "bsc" },
  { list: polygon, network: "polygon" },
  { list: solanaL,     network: "solana" },
  { list: trc20,   network: "tron" },
  { list: stockSolana, network: "solana" },
  { list: forexSolana, network: "solana" },
];


/**
 * Build { "<chainId>:<symbol>:<address>": { uri } } map
 */
function buildIconMap() {
  const map = {};
  for (const { list } of jsonSources) {
    if (!Array.isArray(list)) continue;
    for (const token of list) {
      const chainId = token.chainId ?? "unknown";
      const symbol = token.symbol?.trim();
      const address = token.contractAddress?.trim();
      const logoUrl = token.logoUrl || token.logo || token.logoURI || null;

      if (!symbol || !address || !logoUrl) continue;
      const key = `${chainId}:${symbol}:${address}`.toLowerCase();
      map[key] = { uri: logoUrl };
    }
  }

  console.log('🖼️ TokenIconStore: Built icon map with', Object.keys(map).length, 'entries');
  
  // Debug: Check if default tokens are in the map
  const defaultTokens = ['XUSDT', 'JYB', 'SLX', 'BTC', 'ETH', 'DOGE', 'LTC', 'USDC'];
  const solanaDefaults = Object.keys(map).filter(k => 
    k.startsWith('solana:') && 
    defaultTokens.some(t => k.includes(t.toLowerCase()))
  );
  console.log('🎯 Default Solana tokens in icon map:', solanaDefaults.length);
  solanaDefaults.forEach(k => console.log('   -', k));

  // --- Add mainnet native coin icons ---
  map["bitcoin:btc"] = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png" };
  map["1:eth"]       = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png" };
  map["56:bnb"]      = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" };
  map["137:pol"]   = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png" };
  map["tron:trx"]    = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png" };
  map["solana:sol"]  = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png" };

  // --- Add stock token icons ---
  map["solana:amzn:e29pz9m3ugjfccbsm75o92drjfezschdJMg7ratgxmxe"] = { uri: "https://images.icon-icons.com/91/PNG/512/amazon_16438.png" };
  map["solana:goog:5r1q11v283moqghg6yjoyajbajdqk1yyps4xqx6wat34"] = { uri: "https://s3-symbol-logo.tradingview.com/alphabet--600.png" };
  map["solana:tsla:dvk7vth5nn4qwnux3ycdmfpsulwvopxcsg8uwnbyaqn9"] = { uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Tesla_Motors.svg/1200px-Tesla_Motors.svg.png" };
  map["solana:aapl:8xwdphtw4jmdwhk5pmtn2gzwpar89tnbgamhnnpjntr3"] = { uri: "https://www.apple.com/ac/structured-data/images/knowledge_graph_logo.png?201609051049" };
  
  // --- Add forex token icons ---
  map["solana:cnyusd:4ltu6v4zrvfjdvyok5ik9nadyx6chdngummmu6vrwki42"] = { uri: "https://responsive.fxempire.com/v7/_fx-ui-mfe_/currencies/production/usd-cny.svg" };

  // --- Add default Solana X token icons ---
  map["solana:xusdt:cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4"] = { uri: "https://i.postimg.cc/DwMQG9V3/Gemini-Generated-Image-1uiat01uiat01uia-(1).png" };
  map["solana:jyb:5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8"] = { uri: "https://i.postimg.cc/Njz8X3hc/Gemini-Generated-Image-9uvvte9uvvte9uvv-(1).png" };
  map["solana:slx:ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh"] = { uri: "https://i.postimg.cc/vZN7npJ2/SLX-COIN-(241209).png" };
  map["solana:btc:3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf"] = { uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png" };
  map["solana:eth:3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell"] = { uri: "https://i.pinimg.com/originals/49/d1/0c/49d10cb0a3c978475a49f239e4e2f060.png" };
  map["solana:doge:7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd"] = { uri: "https://cryptologos.cc/logos/dogecoin-doge-logo.png" };
  map["solana:ltc:c7za45tep96bqebrgxgqi5bgn4gvm2iqo3z41rpfpdh4a"] = { uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/GoQjhy3tBcXRWdNfvyh6MPhiQAkNdrAyCJdqWJ3WuUpW/logo.png" };
  map["solana:usdc:4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh"] = { uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" };

  // --- Add common fallback ---
  map.fallback = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png" };           // Generic Tether fallback

  return map;
}
// --- Build once at startup
const initialIcons = buildIconMap();

// --- Store ---
export const tokenIconStore = proxy({
  icons: initialIcons,

  getIcon(key) {
    return tokenIconStore.icons[key?.toLowerCase?.()] || tokenIconStore.icons.fallback;
  },

  addIcon(key, iconSource) {
    tokenIconStore.icons[key?.toLowerCase?.()] = iconSource;
  },
});
