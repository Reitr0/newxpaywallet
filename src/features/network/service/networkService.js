// src/features/network/service/networkService.js

import log from '@src/shared/infra/log/logService';
import db from '@src/shared/infra/db/db';

// Keep your big defaults as-is (paste the object you provided)
export const DEFAULTS_NETWORKS = {
  bitcoin: {
    mainnet: {
      chainId: 'bitcoin',
      label: 'Bitcoin Mainnet',
      mempoolBase: 'https://mempool.space/api',
      explorerTxBase: 'https://mempool.space/tx/',
      explorerAddressBase: 'https://mempool.space/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
      symbol : 'BTC',
      decimals: 8,
      network: 'mainnet',
    },
    testnet: {
      chainId: 'bitcoin-testnet',
      label: 'Bitcoin Testnet',
      mempoolBase: 'https://mempool.space/testnet/api',
      explorerTxBase: 'https://mempool.space/testnet/tx/',
      explorerAddressBase: 'https://mempool.space/testnet/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
      symbol : 'BTC',
      decimals: 8,
      network: 'testnet',
    },
    signet: {
      chainId: 'bitcoin-signet',
      label: 'Bitcoin Signet',
      mempoolBase: 'https://mempool.space/signet/api',
      explorerTxBase: 'https://mempool.space/signet/tx/',
      explorerAddressBase: 'https://mempool.space/signet/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
      symbol : 'BTC',
      decimals: 8,
      network: 'signet',
    },
  },

  ethereum: {
    mainnet: {
      chainId: 1,
      label: 'Ethereum Mainnet',
      rpc: 'https://mainnet.infura.io/v3/45cd0ef9d5b64a9d88dbf7cae5c0e3a9',
      explorerTxBase: 'https://etherscan.io/tx/',
      explorerAddressBase: 'https://etherscan.io/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
      symbol : 'ETH',
      decimals: 18,
    },
    sepolia: {
      chainId: 11155111,
      label: 'Ethereum Sepolia',
      rpc: 'https://eth-sepolia.g.alchemy.com/v2/L5-UfnJGAwFFCwnRT0FGkkzPUxrdoXUI',
      explorerTxBase: 'https://sepolia.etherscan.io/tx/',
      explorerAddressBase: 'https://sepolia.etherscan.io/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
      symbol : 'ETH',
      decimals: 18,
    },
  },

  bsc: {
    mainnet: {
      chainId: 56,
      label: 'BNB Smart Chain',
      rpc: 'https://bsc-mainnet.infura.io/v3/45cd0ef9d5b64a9d88dbf7cae5c0e3a9',
      explorerTxBase: 'https://bscscan.com/tx/',
      explorerAddressBase: 'https://bscscan.com/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png',
      symbol : 'BNB',
      decimals: 18,
    },
    testnet: {
      chainId: 97,
      label: 'BNB Chain Testnet',
      rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      explorerTxBase: 'https://testnet.bscscan.com/tx/',
      explorerAddressBase: 'https://testnet.bscscan.com/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png',
      symbol : 'BNB',
      decimals: 18,
    },
  },

  polygon: {
    mainnet: {
      chainId: 137,
      label: 'Polygon Mainnet',
      rpc: 'https://polygon-mainnet.infura.io/v3/45cd0ef9d5b64a9d88dbf7cae5c0e3a9',
      explorerTxBase: 'https://polygonscan.com/tx/',
      explorerAddressBase: 'https://polygonscan.com/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
      symbol : 'POL',
      decimals: 18,
    },
    amoy: {
      chainId: 80002,
      label: 'Polygon Amoy',
      rpc: 'https://rpc-amoy.polygon.technology',
      explorerTxBase: 'https://www.oklink.com/amoy/tx/',
      explorerAddressBase: 'https://www.oklink.com/amoy/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
      symbol : 'POL',
      decimals: 18,
    },
  },

  tron: {
    mainnet: {
      chainId: 'tron',
      label: 'Tron Mainnet',
      rpc: 'https://api.trongrid.io',
      explorerTxBase: 'https://tronscan.org/#/transaction/',
      explorerAddressBase: 'https://tronscan.org/#/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
      network: 'mainnet',
      symbol : 'TRX',
      decimals: 6,
    },
    testnet: {
      chainId: 'tron-testnet',
      label: 'Tron Nile Testnet',
      rpc: 'https://api.nileex.io',
      explorerTxBase: 'https://nile.tronscan.org/#/transaction/',
      explorerAddressBase: 'https://nile.tronscan.org/#/address/',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
      network: 'testnet',
      symbol : 'TRX',
      decimals: 6,
    },
  },

  solana: {
    mainnet: {
      chainId: 'solana',
      label: 'Solana Mainnet',
      rpc: 'https://solana-mainnet.core.chainstack.com/2ef19b6485a2171959b47e653266c846',
      explorerTxBase: 'https://explorer.solana.com/tx/',
      explorerAddressBase: 'https://explorer.solana.com/address/',
      explorerClusterParam: '',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
      symbol : 'SOL',
      decimals: 9,
      network: 'mainnet',
    },
    devnet: {
      chainId: 'solana-devnet',
      label: 'Solana Devnet',
      rpc: 'https://api.devnet.solana.com',
      explorerTxBase: 'https://explorer.solana.com/tx/',
      explorerAddressBase: 'https://explorer.solana.com/address/',
      explorerClusterParam: '?cluster=devnet',
      logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
      symbol : 'SOL',
      decimals: 9,
      network: 'devnet',
    },
  },
};

// Dev-friendly default environments (tweak to taste)
export const DEFAULT_ENVIRONMENTS = {
  bitcoin:  'mainnet',
  ethereum: 'mainnet',
  bsc:      'mainnet',
  polygon:  'mainnet',
  tron:     'mainnet',
  solana:   'mainnet',
};

const networksDoc = db.doc('networks.v1', {
  defaults: {
    v: 1,
    envs: { ...DEFAULT_ENVIRONMENTS },
  },
});

function getFamilies() {
  return Object.keys(DEFAULTS_NETWORKS);
}

function safeGetConfig(family, env) {
  const fam = DEFAULTS_NETWORKS[family] || {};
  return fam[env] || null;
}

export const networkService = {
  get() {
    try {
      return networksDoc.get();
    } catch (e) {
      log.warn('networkService.get failed', { message: e?.message });
      return { v: 1, envs: { ...DEFAULT_ENVIRONMENTS } };
    }
  },

  update(patch = {}) {
    try {
      const saved = networksDoc.patch((cur) => ({ ...cur, ...patch }));
      log.debug('networkService.update ok', { keys: Object.keys(patch) });
      return saved;
    } catch (e) {
      log.warn('networkService.update failed', { message: e?.message });
      return this.get();
    }
  },

  reset() {
    try {
      return networksDoc.reset();
    } catch (e) {
      log.warn('networkService.reset failed', { message: e?.message });
      return { v: 1, envs: { ...DEFAULT_ENVIRONMENTS } };
    }
  },

  setEnv(family, envKey) {
    const families = getFamilies();
    if (!families.includes(family)) {
      log.warn('networkService.setEnv invalid family', { family });
      return this.get();
    }
    const cfg = safeGetConfig(family, envKey);
    if (!cfg) {
      log.warn('networkService.setEnv invalid env', { family, envKey });
      return this.get();
    }
    return this.update({ envs: { ...this.get().envs, [family]: envKey } });
  },

  setManyEnvs(envMap = {}) {
    const cur = this.get().envs || {};
    const next = { ...cur };
    for (const [fam, envKey] of Object.entries(envMap)) {
      if (DEFAULTS_NETWORKS[fam]?.[envKey]) next[fam] = envKey;
    }
    return this.update({ envs: next });
  },

  getEnv(family) {
    const envs = this.get().envs || {};
    return envs[family] || DEFAULT_ENVIRONMENTS[family];
  },

  getCurrentConfig(family) {
    const env = this.getEnv(family);
    return safeGetConfig(family, env);
  },

  getAllCurrentConfigs() {
    const envs = this.get().envs || {};
    const out = {};
    for (const fam of getFamilies()) {
      out[fam] = safeGetConfig(fam, envs[fam] || DEFAULT_ENVIRONMENTS[fam]);
    }
    return out;
  },

  getExplorerTxUrl(family, txid) {
    const cfg = this.getCurrentConfig(family);
    if (!cfg) return null;
    const base = cfg.explorerTxBase || cfg.mempoolBase || '';
    const extra = cfg.explorerClusterParam || '';
    return txid ? `${base}${txid}${extra}` : null;
  },

  getExplorerAddressUrl(family, address) {
    const cfg = this.getCurrentConfig(family);
    if (!cfg) return null;
    const base = cfg.explorerAddressBase || '';
    const extra = cfg.explorerClusterParam || '';
    return address ? `${base}${address}${extra}` : null;
  },

  families: getFamilies,
  options(family) {
    return Object.keys(DEFAULTS_NETWORKS[family] || {});
  },
};
