import { proxy } from 'valtio';

import erc20 from '@src/features/tokens/registry/json/erc20.json';
import bep20 from '@src/features/tokens/registry/json/bep20.json';
import polygon from '@src/features/tokens/registry/json/polygon.json';
import solanaL from '@src/features/tokens/registry/json/solona.json';
import trc20 from '@src/features/tokens/registry/json/trc20.json';

const jsonSources = [
  { list: erc20,   network: "ethereum" },
  { list: bep20,   network: "bsc" },
  { list: polygon, network: "polygon" },
  { list: solanaL,     network: "solana" },
  { list: trc20,   network: "tron" },
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
      const logoUrl = token.logoUrl || token.logo || null;

      if (!symbol || !address || !logoUrl) continue;
      const key = `${chainId}:${symbol}:${address}`.toLowerCase();
      map[key] = { uri: logoUrl };
    }
  }

  // --- Add mainnet native coin icons ---
  map["bitcoin:btc"] = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png" };
  map["1:eth"]       = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png" };
  map["56:bnb"]      = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" };
  map["137:pol"]   = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png" };
  map["tron:trx"]    = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png" };
  map["solana:sol"]  = { uri: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png" };

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
