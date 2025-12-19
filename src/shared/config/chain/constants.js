/**
 * Wallet Chain Family Constants
 * -----------------------------------
 * Used across:
 * - walletBuilder.js
 * - walletService.js
 * - tokenCatalogService.js
 * - tokenCatalogStore.js
 * - walletRepository.js
 *
 * Defines consistent family identifiers for per-chain token handling
 * and wallet grouping.
 */

export const WALLET_FAMILY = {
  ETHEREUM: 'ethereum',
  BSC: 'bsc',
  POLYGON: 'polygon',
  SOLANA: 'solana',
  TRON: 'tron',
  BITCOIN: 'bitcoin', // alias for btc
};

export const CHAIN_ID_TO_FAMILY = {
  1: 'ethereum',
  56: 'bsc',
  137: 'polygon',
  solana: 'solana',
  tron: 'tron',
  bitcoin: 'bitcoin',
};

export const FAMILY_TO_CHAIN_ID = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  solana: 'solana',
  tron: 'tron',
  bitcoin: 'bitcoin',
};

export const CHAIN_TAGS = [
  { id: 'all',      label: 'All Networks' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'bsc',      label: 'BNB Smart Chain' },
  { id: 'polygon',  label: 'Polygon' },
  { id: 'solana',   label: 'Solana' },
  { id: 'tron',     label: 'Tron' },
];


// Map your internal chain keys (used in walletStore) to Moralis identifiers
export const MORALIS_CHAIN_MAP = {
  ethereum: 'eth',
  bsc: 'bsc',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avalanche',
  fantom: 'fantom',
  base: 'base',
  cronos: 'cronos',
  gnosis: 'gnosis',
  celo: 'celo',
  moonbeam: 'moonbeam',
  moonriver: 'moonriver',
  kava: 'kava',
  linea: 'linea',
  // You can extend this as needed
};

/**
 * Converts an internal chain identifier to a Moralis-compatible chain string.
 * If no match is found, returns the original chain string.
 */
export function toMoralisChain(chain) {
  if (!chain) return undefined;
  const key = String(chain).toLowerCase();
  return MORALIS_CHAIN_MAP[key] || key;
}
