import { proxy } from 'valtio';

import log from '@src/shared/infra/log/logService';
import { walletService } from '@features/wallet/service/walletService';
import { walletRegistryStore } from '@features/wallet/state/walletRegistryStore';
import { networkStore } from '@features/network/state/networkStore';
import { tokenPriceStore } from '@features/tokens/price/state/tokenPriceStore';
import { CHAIN_ID_TO_FAMILY, toMoralisChain } from '@src/shared/config/chain/constants';

export const walletStore = proxy({
  status: 'idle',          // 'idle' | 'loading' | 'ready' | 'error'
  error: null,
  mnemonic: '',
  data: {},                // { [chain]: Array<{ address, label? }> }
  instances: {},           // { [chain]: walletInstance }
  assets: [],              // domain assets: native + tokens (no UI fields)
  portfolio: {
    totalUsd: 0,
    changeUsd24h: 0,
    changePct24h: 0,
  },
  /* ----------------------- Import / Init wallets ----------------------- */
  async init(mnemonic, opts) {
    try {
      this.status = 'loading';
      this.error = null;

      const { mnemonic : savedMnemonic, saved, instances } = await walletService.init(mnemonic, opts);

      const assembled = [];
      const registeredByChain = Object.create(null); // avoid double register per chain

      // Iterate chains safely
      // eslint-disable-next-line guard-for-in
      for (const chain in saved) {
        if (!Object.prototype.hasOwnProperty.call(saved, chain)) continue;

        const inst  = instances[chain];
        const metas = saved[chain];                  // wallets on this chain (addresses)
        const tokens = walletRegistryStore.list(chain) || []; // chain-wide enabled tokens

        // Register tokens once per chain if supported
        if (!registeredByChain[chain] && inst && typeof inst.registerToken === 'function' && Array.isArray(tokens)) {
          for (let k = 0; k < tokens.length; k++) {
            try {
              await inst.registerToken(tokens[k]);
            } catch (e) {
              log.warn('walletStore.init registerToken failed', {
                chain,
                symbol: tokens[k]?.symbol,
                message: e?.message,
              });
            }
          }
          registeredByChain[chain] = true;
        }

        // For each wallet address on this chain:
        if (Array.isArray(metas)) {
          for (let i = 0; i < metas.length; i++) {
            const m = metas[i];

            // 1) Native asset for this wallet address
            const nativeAsset = this._toNativeAsset(chain, m);
            if (nativeAsset) assembled.push(nativeAsset);

            // 2) Token assets for this wallet address (⚠ includes walletAddress)
            if (Array.isArray(tokens)) {
              for (let t = 0; t < tokens.length; t++) {
                const tokenAsset = this._toTokenAsset(chain, m?.address, tokens[t]);
                if (tokenAsset) assembled.push(tokenAsset);
              }
            }
          }
        }
      }

      // Persist state
      this.data = saved;
      this.instances = instances;
      this.assets = assembled;
      this.status = 'ready';
      this.mnemonic = savedMnemonic;
      this.recomputePortfolio();
      log.info('walletStore.init ok', {
        chains: Object.keys(instances),
        assets: assembled.length,
      });
    } catch (e) {
      this.status = 'error';
      this.error = e?.message;
      log.error('walletStore.init failed', { message: e?.message });
      throw e;
    }
  },

  /* ----------------------- Add a token (register → persist → attach) ----------------------- */
  /**
   * Add/enable a token for a given chain.
   * Steps:
   *   1) registerToken on chain instance (if supported)
   *   2) persist into registry (walletRegistryStore.add)
   *   3) attach token asset to the provided walletAddress (and only that wallet)
   *
   * @param {string} chain
   * @param {string} walletAddress  - which wallet this token belongs to (lowercased inside)
   * @param {object} tokenMeta      - { symbol, address, decimals, ... }
   * @returns {object[]} updated token list for this chain from the registry
   */
  async addToken(chain, walletAddress, tokenMeta) {
    try {
      // 1) Register on instance first
      const inst = this.instances?.[chain];
      if (inst && typeof inst.registerToken === 'function') {
        try {
          await inst.registerToken(tokenMeta);
        } catch (e) {
          // we still continue to persist, but log the failure
          log.warn('walletStore.addToken registerToken failed', {
            chain,
            symbol: tokenMeta?.symbol,
            message: e?.message,
          });
        }
      }

      // 2) Persist into chain-only registry
      const out = walletRegistryStore.add(chain, tokenMeta) || [];

      // 3) Attach to the requested wallet only (asset carries wallet address)
      const asset = this._toTokenAsset(chain, walletAddress, tokenMeta);
      if (asset) this._upsertAsset(asset);
      this.recomputePortfolio();
      return out;
    } catch (e) {
      log.warn('walletStore.addToken failed', { chain, message: e?.message });
      throw e;
    }
  },

  /* ----------------------- Remove a token ----------------------- */
  /**
   * Remove/disable a token for a given chain.
   * - Optional: if instance supports unregisterToken, call it.
   * - Remove from registry
   * - Remove all per-wallet token assets matching (chain, tokenAddress)
   */
  async removeToken(chain, tokenAddressOrPredicate) {
    try {
      const inst = this.instances?.[chain];
      if (inst && typeof inst.unregisterToken === 'function' && typeof tokenAddressOrPredicate === 'string') {
        try {
          await inst.unregisterToken(tokenAddressOrPredicate);
        } catch (e) {
          log.warn('walletStore.removeToken unregisterToken failed', {
            chain,
            token: tokenAddressOrPredicate,
            message: e?.message,
          });
        }
      }

      const out = walletRegistryStore.remove(chain, tokenAddressOrPredicate) || [];

      // prune assets for this chain/token
      if (typeof tokenAddressOrPredicate === 'string') {
        const addrL = String(tokenAddressOrPredicate).toLowerCase();
        this._removeTokenAssetsByAddress(chain, addrL);
      } else {
        // predicate: rebuild token assets for this chain based on registry state
        this._rebuildTokenAssetsForChain(chain, out);
      }
      this.recomputePortfolio();
      return out;
    } catch (e) {
      log.warn('walletStore.removeToken failed', { chain, message: e?.message });
      throw e;
    }
  },
  /**
   * Get the first wallet address for a given chain identifier.
   * - Accepts chain name ("ethereum"), numeric chain ID (56), or chainKey ("1").
   * - Returns lowercase address or undefined if not found.
   */
  getWalletAddressByChain(chain) {
    if (!chain) return undefined;

    const chainKey = String(chain).toLowerCase();
    const candidates =
      this.data?.[chainKey] ||
      this.data?.[String(Number(chain))] || // e.g. '56'
      this.data?.[chain];                   // fallback

    if (!Array.isArray(candidates) || candidates.length === 0) return undefined;

    const addr = candidates[0]?.address;
    return addr ? String(addr) : undefined;
  },
  /* ----------------------- Reset everything ----------------------- */
  reset() {
    try {
      this.status = 'loading';
      this.error = null;
      this.data = walletService.reset();
      this.instances = {};
      this.assets = [];
      this.status = 'ready';
      log.info('walletStore.reset ok');
    } catch (e) {
      this.status = 'error';
      this.error = e?.message;
      log.warn('walletStore.reset failed', { message: e?.message });
    }
  },

  /**
   * Fetch balances for all known assets (or a specific chain),
   * and update the in-store `assets` array in-place with:
   *   - balance: string
   *   - balanceNum: number
   *
   * It will:
   *  - Prefer instance methods with wallet address if available:
   *      getNativeBalanceFor(address?), getTokenBalanceFor(address, token)
   *  - Fallback to:
   *      getNativeBalance(), getTokenBalance(token)
   *
   * @param {{ chain?: string }} [opts]
   */
  async fetchBalances(opts = {}) {
    const limitToChain = opts?.chain;

    // Group asset indices by chain to update efficiently
    const byChain = Object.create(null);
    for (let i = 0; i < this.assets.length; i++) {
      const a = this.assets[i];
      if (!a) continue;
      if (limitToChain && a.chain !== limitToChain) continue;
      (byChain[a.chain] ||= []).push(i);
    }

    // Process each chain
    // eslint-disable-next-line guard-for-in
    for (const chain in byChain) {
      if (!Object.prototype.hasOwnProperty.call(byChain, chain)) continue;

      const inst = this.instances?.[chain];
      const idxs = byChain[chain];
      if (!inst || !Array.isArray(idxs) || idxs.length === 0) continue;

      // Concurrency limiter per chain (default 6)
      await this._mapLimit(
        idxs,
        6,
        async (assetIndex) => {
          const asset = this.assets[assetIndex];
          if (!asset) return;

          try {
            let bal;
            if (!asset.isToken) {
              if (typeof inst.getNativeBalance === 'function') {
                bal = await inst.getNativeBalance();
              }
            } else {
              if (typeof inst.getTokenBalance === 'function') {
                bal = await inst.getTokenBalance(asset.tokenAddress);
              }
            }
            const total = this._safeNum(bal?.total);
            this.assets[assetIndex] = {
              ...asset,
              balance: String(bal?.total ?? '0'),
              balanceNum: total,
            };
          } catch (e) {
            log.warn('walletStore.fetchBalances failed for asset', {
              chain: asset.chain,
              isToken: asset.isToken,
              token: asset.tokenAddress,
              address: asset.address,
              message: e?.message,
            });
            this.assets[assetIndex] = {
              ...asset,
              balance: '0',
              balanceNum: 0,
            };
          }
        }
      );
    }
    this.recomputePortfolio();
  },
  recomputePortfolio() {
    try {
      const assets = Array.isArray(this.assets) ? this.assets : [];
      let totalUsd = 0;
      let changeUsd24h = 0;
      let prevTotalUsd = 0;

      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const bal = Number(a?.balanceNum ?? a?.balance ?? 0) || 0;
        if (bal <= 0) continue;

        const p = this._priceRowForAsset(a);
        const price = Number(p?.price ?? 0) || 0;
        const curUsd = bal * price;
        totalUsd += curUsd;

        // compute 24h change for this asset
        let deltaUsd = 0;
        if (Number.isFinite(p?.priceChange)) {
          deltaUsd = bal * Number(p.priceChange);
        } else if (Number.isFinite(p?.priceChangePercent)) {
          deltaUsd = curUsd * (Number(p.priceChangePercent) / 100);
        } else if (Number.isFinite(p?.lastPrice)) {
          deltaUsd = bal * (price - Number(p.lastPrice));
        }
        changeUsd24h += deltaUsd;

        // previous value for pct denominator
        const prevUsd = curUsd - deltaUsd;
        prevTotalUsd += prevUsd;
      }

      const changePct24h = prevTotalUsd > 0 ? (changeUsd24h / prevTotalUsd) * 100 : 0;

      this.portfolio = {
        totalUsd,
        changeUsd24h,
        changePct24h,
      };
    } catch (e) {
      log.warn('walletStore.recomputePortfolio failed', { message: e?.message });
    }
  },
  async sendDappsTransaction(tx, chainId) {
    const chain = CHAIN_ID_TO_FAMILY[chainId];
    const inst = this.instances?.[chain];
    return await inst.sendDappsTransaction(tx);
  },
  /**
   * Return the current block number of a chain
   */
  async getBlockNumber(chainId) {
    const chain = CHAIN_ID_TO_FAMILY[chainId];
    const inst = this.instances?.[chain];
    if (!inst || typeof inst.getBlockNumber !== 'function') {
      throw new Error(`getBlockNumber not supported for chain ${chain}`);
    }
    return await inst.getBlockNumber();
  },
  /**
   * Estimate gas for a transaction
   * @param {object} tx - { from, to, data?, value? }
   * @param chainId
   */
  async estimateGas(tx, chainId) {
    const chain = CHAIN_ID_TO_FAMILY[chainId];
    const inst = this.instances?.[chain];
    if (!inst) throw new Error(`No wallet instance for chain ${chain}`);
    if (typeof inst.estimateGas === 'function') {
      return await inst.estimateGas(tx);
    }
    if (typeof inst.estimate === 'function') {
      const res = await inst.estimate(tx);
      return res?.gas || res;
    }
    throw new Error('estimateGas not supported');
  },
  /**
   * Perform a read-only call (eth_call)
   * @param {object} tx - { to, data }
   * @param chainId
   */
  async call(tx, chainId) {
    const chain = CHAIN_ID_TO_FAMILY[chainId];
    const inst = this.instances?.[chain];
    if (!inst) throw new Error(`No wallet instance for chain ${chain}`);
    if (typeof inst.call === 'function') {
      return await inst.call(tx);
    }
    if (typeof inst.read === 'function') {
      return await inst.read(tx);
    }
    throw new Error('call not supported for this wallet');
  },
  /**
   * Sign a personal message (EIP-191)
   */
  async signPersonalMessage(address, message, chainId) {
    const chain = CHAIN_ID_TO_FAMILY[chainId];
    const inst = this.instances?.[chain];
    if (!inst) throw new Error(`No wallet instance for chain ${chain}`);
    if (typeof inst.signMessage === 'function') {
      return await inst.signMessage(address, message);
    }
    if (typeof inst.signPersonalMessage === 'function') {
      return await inst.signPersonalMessage(address, message);
    }
    throw new Error('signPersonalMessage not implemented for this wallet');
  },

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedDataV4(address, typedJson, chainId) {
    const chain =  CHAIN_ID_TO_FAMILY[chainId];
    const inst = this.instances?.[chain];
    if (!inst) throw new Error(`No wallet instance for chain ${chain}`);
    if (typeof inst.signTypedDataV4 === 'function') {
      return await inst.signTypedDataV4(address, typedJson);
    }
    if (typeof inst.signTypedData === 'function') {
      return await inst.signTypedData(address, typedJson);
    }
    throw new Error('signTypedDataV4 not implemented for this wallet');
  },
  /**
   * Switch active chain for DApp
   */
  async switchChain(targetChainId) {
    const chainKey = CHAIN_ID_TO_FAMILY[targetChainId];
    const inst = this.instances?.[chainKey];
    if (!inst) throw new Error(`Unsupported chain: ${targetChainId}`);
    return { chainId: targetChainId };
  },
  /* ----------------------- Domain mappers (no UI) ----------------------- */
  _priceRowForAsset(a) {
    if (!a?.symbol) return null;
    const key = a.symbol === 'USDT' ? 'USDTDAI' : (a.symbol + 'USDT');
    return tokenPriceStore.prices?.[key] || null;
  },

  _safeNum(x) {
    if (x == null) return 0;
    if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
    const n = Number(String(x));
    return Number.isFinite(n) ? n : 0;
  },

  async _mapLimit(indexes, limit, worker) {
    if (!Array.isArray(indexes) || indexes.length === 0) return;
    const n = Math.max(1, Math.min(limit || 1, indexes.length));
    let i = 0;
    const runners = new Array(n).fill(0).map(async () => {
      while (i < indexes.length) {
        const myIdx = i++;
        await worker(indexes[myIdx]);
      }
    });
    await Promise.all(runners);
  },
  _toNativeAsset(chain, walletMeta) {
    const net = networkStore.getConfig(chain);
    if (!net) return null;

    const chainId  = net.chainId;
    const symbol   = net.symbol || String(chain).toUpperCase();
    const decimals = Number(net.decimals ?? 18);

    const address = String(walletMeta?.address || '');
    const id = `${chainId}:${symbol}`.toLowerCase();

    return {
      id,
      isToken: false,
      chain,
      chainId,
      symbol,
      decimals,
      address: address || undefined,
      networkLogoUrl: net.logoUrl,
      tag: chain
    };
  },

  _toTokenAsset(chain, walletAddress, tokenMeta) {
    const net = networkStore.getConfig(chain);
    if (!net) return null;

    const chainId     = tokenMeta?.chainId ?? net.chainId;
    const symbol      = tokenMeta?.symbol;
    const tokenAddr   = String(tokenMeta?.address || '').toLowerCase();
    const walletAddrL = String(walletAddress || '');

    if (!symbol || !tokenAddr) return null;

    const decimals = Number(tokenMeta?.decimals ?? 18);
    // Include walletAddr in id to differentiate the same token across multiple wallets
    const id = `${String(chainId).toLowerCase()}:${String(symbol).toLowerCase()}:${tokenAddr}`;

    return {
      id,
      isToken: true,
      chain,
      chainId,
      symbol,
      decimals,
      tokenAddress: tokenAddr,
      address: walletAddrL || undefined,
      networkLogoUrl: net.logoUrl,
      tag: chain
    };
  },
  getInstance(chain) {
    return this.instances[chain];
  },

  async sendTransaction({ chain, to, amount, tokenAddress = null, platformFee }) {
    const wallet = this.getInstance(chain);
    if (!wallet) throw new Error('No active wallet selected');
    const intent = {
      kind: tokenAddress ? 'tokenTransfer' : 'nativeTransfer',
      to,
      amount,
      tokenAddress: tokenAddress || null,
      platformFee: platformFee || null,
    };
    if (typeof wallet.submit === 'function') {
      const { txid } = await wallet.submit(intent);
      return { chain: wallet.chainId || 'unknown', txid };
    }

    if (!tokenAddress && typeof wallet.sendNative === 'function') {
      const txid = await wallet.sendNative(to, amount, { platformFee });
      return { chain: wallet.chainId || 'unknown', txid };
    }
    if (tokenAddress && typeof wallet.sendToken === 'function') {
      const txid = await wallet.sendToken(tokenAddress, to, amount, { platformFee });
      return { chain: wallet.chainId || 'unknown', txid };
    }
    if (typeof wallet.sendTransaction === 'function') {
      const txid = await wallet.sendTransaction({ to, amount, tokenAddress, platformFee });
      return { chain: wallet.chainId || 'unknown', txid };
    }

    throw new Error('sendTransaction not implemented for this wallet');
  },
  async preflightSend({ chain, to, amount, tokenAddress = null, platformFee = null }) {
    const wallet = this.getInstance(chain);
    if (!wallet) throw new Error('No active wallet selected');

    if (wallet.estimate) {
      const est = await wallet.estimate({
        kind: tokenAddress ? 'tokenTransfer' : 'nativeTransfer',
        to,
        amount,
        tokenAddress,
        platformFee,
      });
      return {
        chain: chain || 'unknown',
        currency: (wallet.info && wallet.info().symbol) || 'NATIVE',
        amount,
        fee: est.fee,
        feeUnit: est.feeUnit || 'feeUnits',
        details: est.details || null,
      };
    }

    throw new Error('Fee estimation not supported for this wallet');
  },
  getTokenBalance(chain, token) {
    if (!token) return { value: 0, formatted: '0', usd: 0 };
    // native vs ERC20/SPL/TRC20
    if (token.native) {
      const v = Number(walletStore.balances?.[chain]?.native || 0);
      const usd = v * Number(token.price || 0);
      return { value: v, formatted: String(v), usd };
    }
    const key = (token.address || token.mint || token.contractAddress || '').toLowerCase();
    const v = Number(walletStore.balances?.[chain]?.tokens?.[key]?.amount || 0);
    const usd = v * Number(token.price || 0);
    return { value: v, formatted: String(v), usd };
  },
  /* ----------------------- Asset list mutations ----------------------- */
  _upsertAsset(asset) {
    const i = this.assets.findIndex((a) => a.id === asset.id);
    if (i >= 0) this.assets[i] = asset;
    else this.assets.push(asset);
  },

  _removeTokenAssetsByAddress(chain, tokenAddrLower) {
    // Remove all token assets for this chain with given tokenAddress
    for (let i = this.assets.length - 1; i >= 0; i--) {
      const a = this.assets[i];
      if (a.isToken && a.chain === chain && a.tokenAddress === tokenAddrLower) {
        this.assets.splice(i, 1);
      }
    }
  },

  _rebuildTokenAssetsForChain(chain, registryTokens) {
    // Remove all token assets for this chain, then re-attach from registry for each wallet on chain
    for (let i = this.assets.length - 1; i >= 0; i--) {
      const a = this.assets[i];
      if (a.isToken && a.chain === chain) this.assets.splice(i, 1);
    }

    const tokens = Array.isArray(registryTokens) ? registryTokens : [];
    const wallets = this.data?.[chain];

    if (Array.isArray(wallets) && wallets.length && tokens.length) {
      for (let w = 0; w < wallets.length; w++) {
        const addr = wallets[w]?.address;
        for (let t = 0; t < tokens.length; t++) {
          const asset = this._toTokenAsset(chain, addr, tokens[t]);
          if (asset) this._upsertAsset(asset);
        }
      }
    }
  },
  /**
   * Fetch transaction history for a chain (native or a specific token).
   * Delegates to the chain instance (e.g., EvmWallet -> Moralis).
   *
   * @param {object} opts
   * @param {string} opts.chain                 // e.g. 'ethereum', 'bsc', 'polygon'
   * @param {string} [opts.address]             // wallet address; if omitted we use the first wallet of the chain
   * @param {string} [opts.tokenAddress=null]   // ERC-20 address => token history; omitted => native history
   * @param {number} [opts.limit=20]            // page size
   * @param {string} [opts.cursor]              // Moralis pagination cursor (next page)
   * @returns {Promise<{ items: Array, cursor?: string }>}
   */
  async getTransactionHistory({ chain, address, tokenAddress = null, limit = 20, cursor } = {}) {
    const inst = this.getInstance(chain);
    if (!inst) throw new Error(`No active wallet instance for chain ${chain}`);

    // Resolve address if not provided
    const addr = (address || this.getWalletAddressByChain(chain));
    if (!addr) throw new Error(`No wallet address found for chain ${chain}`);

    if (typeof inst.getTransactionHistory !== 'function') {
      throw new Error('getTransactionHistory not implemented for this wallet instance');
    }

    try {
      const res = await inst.getTransactionHistory({
        address: addr,
        tokenAddress,
        limit,
        chain : toMoralisChain(chain)
      });

      // Instance should already normalize, but ensure a stable shape here.
      // Accept both array and {result, cursor} forms.
      if (Array.isArray(res)) {
        return { items: res };
      }
      if (res && Array.isArray(res.items)) {
        return { items: res.items, cursor: res.cursor };
      }
      if (res && Array.isArray(res.result)) {
        return { items: res.result, cursor: res.cursor };
      }
      return { items: [] };
    } catch (e) {
      log.warn('walletStore.getTransactionHistory failed', {
        chain,
        tokenAddress,
        message: e?.message,
      });
      throw e;
    }
  }
});
