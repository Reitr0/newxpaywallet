// src/modules/wallet/factory/walletBuilder.js
import BtcWallet from '@src/features/wallet/blockchain/signers/btcWallet';
import EvmWallet from '@src/features/wallet/blockchain/signers/evmWallet';
import SolWallet from '@src/features/wallet/blockchain/signers/solWallet';
import TronWallet from '@src/features/wallet/blockchain/signers/tronWallet';
import { makeRpcSolTxHistoryProvider, solProvider } from '@features/wallet/blockchain/providers/solProvider';
import createTronTxProvider, { tronProvider } from '@features/wallet/blockchain/providers/tronProvider';
import { evmProvider } from '@features/wallet/blockchain/providers/evmProvider';
import { bitcoinProvider } from '@features/wallet/blockchain/providers/bitcoinProvider';

/* -----------------------------------
 * Bitcoin builder
 * ----------------------------------- */
async function buildBitcoinWallet({ privateKey, network, networkConfig, index = 0 }) {
  return new BtcWallet({
    // signing/UTXO deps
    getNode:              (i) => { return {privateKey : privateKey}},
    utxoProvider:         bitcoinProvider.listUnspent,
    feeRateProvider:      bitcoinProvider.feeRateProvider,
    broadcaster:          bitcoinProvider.broadcaster,
    rawTxProvider:        bitcoinProvider.fetchRawTxHex,
    txHistoryProvider:    bitcoinProvider.txHistoryProvider,
    network:              network, // 'mainnet' | 'testnet' | 'signet'
    chainId:              networkConfig.chainId,
    label:                networkConfig.label,
    symbol:               networkConfig.symbol,
    decimals:             networkConfig.decimals,
    explorerBaseUrl:      networkConfig.explorerTxBase,
    explorerAddressBase:  networkConfig.explorerAddressBase,
    networkLogoUrl:       networkConfig.logoUrl,
  });
}

/* -----------------------------------
 * EVM builder (per-chain: ethereum | bsc | polygon)
 * ----------------------------------- */
const EVM_NATIVE = {
  ethereum: { symbol: 'ETH',   decimals: 18 },
  bsc:      { symbol: 'BNB',   decimals: 18 },
  polygon:  { symbol: 'POL', decimals: 18 },
};


async function buildEvmWallet({privateKey, networkConfig, family = 'ethereum', index = 0 }) {
  const native = EVM_NATIVE[family] || EVM_NATIVE.ethereum;
  return new EvmWallet({
    rpcUrl: networkConfig.rpc,
    provider: evmProvider.jsonRpcProvider(networkConfig.rpc),
    txHistoryProvider: evmProvider.txHistoryProvider(),
    getPrivateKey: (i) => {
      return privateKey
    },
    chainId: networkConfig.chainId,              // numeric (1, 56, 137, etc.)
    label: networkConfig.label,
    explorerBaseUrl: networkConfig.explorerTxBase,
    explorerAddressBase: networkConfig.explorerAddressBase,
    symbol: native.symbol,
    decimals: native.decimals,
    networkLogoUrl: networkConfig.logoUrl,
  });
}

/** Build a single EVM token wallet for the given EVM family */
async function buildEvmTokenWallet({privateKey, networkConfig, family = 'ethereum', index = 0, token}) {
  const native = EVM_NATIVE[family] || EVM_NATIVE.ethereum;
  const deps = {
    rpcUrl:              networkConfig.rpc,
    getPrivateKey:       (i) => {return privateKey},
    chainId:             networkConfig.chainId,
    label:               networkConfig.label,
    explorerBaseUrl:     networkConfig.explorerTxBase,
    explorerAddressBase: networkConfig.explorerAddressBase,
    symbol:              native.symbol,
    decimals:            native.decimals,
    networkLogoUrl:      networkConfig.logoUrl,
    token: {
      address:  token.address,
      symbol:   token.symbol,
      decimals: token.decimals,
      label:    token.label ?? token.symbol,
    },
  };
  const wallet = new EvmWallet(deps);
  return {
    key:   `${networkConfig.chainId}:${(token.symbol || 'TOKEN')}:${token.address}`.toLowerCase(),
    label: `${networkConfig.label} / ${token.label || token.symbol}`,
    wallet,
    index,
  };
}

/* -----------------------------------
 * Solana builder (native + SPL tokens)
 * ----------------------------------- */
async function buildSolanaWallet({privateKey, networkConfig, index = 0}) {
  const deps =  {
    rpcUrl:               networkConfig.rpc,
    txHistoryProvider:    solProvider.txHistoryProvider(networkConfig.rpc),
    getEd25519Seed:       (i) => {return privateKey},
    chainId:              networkConfig.chainId,
    label:                networkConfig.label,
    explorerBaseUrl:      (networkConfig.explorerTxBase || '') + (networkConfig.explorerClusterParam || ''),
    explorerAddressBase:  (networkConfig.explorerAddressBase || '') + (networkConfig.explorerClusterParam || ''),
    networkLogoUrl:       networkConfig.logoUrl,
    symbol:               networkConfig.symbol,
    decimals:             networkConfig.decimals,
  };
  return new SolWallet(deps);
}

/** Single Solana token wallet */
async function buildSolanaTokenWallet({privateKey, networkConfig, index = 0, token}) {
  const deps = {
    rpcUrl:               networkConfig.rpc,
    txHistoryProvider:    solProvider.txHistoryProvider(networkConfig.rpc),
    getEd25519Seed:       (i) => {return privateKey},
    chainId:              networkConfig.chainId,
    label:                networkConfig.label,
    explorerBaseUrl:      (networkConfig.explorerTxBase || '') + (networkConfig.explorerClusterParam || ''),
    explorerAddressBase:  (networkConfig.explorerAddressBase || '') + (networkConfig.explorerClusterParam || ''),
    symbol:               networkConfig.symbol,
    decimals:             networkConfig.decimals,
    networkLogoUrl:       networkConfig.logoUrl,
    token: {
      address:  token.address, // SPL mint
      symbol:   token.symbol,
      decimals: token.decimals,
      label:    token.label ?? token.symbol,
    },
  };
  const wallet = new SolWallet(deps);
  return {
    key:   `${networkConfig.chainId}:${(token.symbol || 'TOKEN')}:${token.address}`.toLowerCase(),
    label: `${networkConfig.label} / ${token.label || token.symbol}`,
    wallet,
    index,
  };
}

/* -----------------------------------
 * Tron builder (native + TRC20 tokens)
 * ----------------------------------- */
async function buildTronWallet({privateKey, networkConfig, index = 0}) {

  const tronDeps = {
    fullHost:             networkConfig.rpc,
    txHistoryProvider:    tronProvider.txHistoryProvider(),
    getPrivateKey:        (i) =>{return privateKey},
    chainId:              networkConfig.chainId,
    label:                networkConfig.label,
    explorerBaseUrl:      networkConfig.explorerTxBase,
    explorerAddressBase:  networkConfig.explorerAddressBase,
    networkLogoUrl:       networkConfig.logoUrl,
    symbol:               networkConfig.symbol,
    decimals:             networkConfig.decimals,
  };

  return new TronWallet(tronDeps);
}

/** Single Tron token wallet */
async function buildTronTokenWallet({privateKey, networkConfig, index = 0, token}) {
  const deps = {
    fullHost:             networkConfig.rpc,
    txHistoryProvider:    tronProvider.txHistoryProvider(),
    getPrivateKey:        (i) =>{return privateKey},
    chainId:              networkConfig.chainId,
    label:                networkConfig.label,
    explorerBaseUrl:      networkConfig.explorerTxBase,
    explorerAddressBase:  networkConfig.explorerAddressBase,
    networkLogoUrl:       networkConfig.logoUrl,
    symbol:               networkConfig.symbol,
    decimals:             networkConfig.decimals,
    token: {
      address:  token.address,
      symbol:   token.symbol,
      decimals: token.decimals,
      label:    token.label ?? token.symbol,
    },
  };
  const wallet = new TronWallet(deps);
  return {
    key:   `${networkConfig.chainId}:${(token.symbol || 'TOKEN')}:${token.address}`.toLowerCase(),
    label: `${networkConfig.label} / ${token.label || token.symbol}`,
    wallet,
    index,
  };
}

export const walletBuilder = {
  // Multi-wallet builders
  buildBitcoinWallet,
  buildEvmWallet,          // now requires { family } in callers where relevant
  buildSolanaWallet,
  buildTronWallet,

  // Single token builders
  buildEvmTokenWallet,      // requires { family } too
  buildSolanaTokenWallet,
  buildTronTokenWallet,
};

