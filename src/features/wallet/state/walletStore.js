import { proxy } from 'valtio';

import log from '@src/shared/infra/log/logService';
import { walletService } from '@features/wallet/service/walletService';
import { walletRegistryStore } from '@features/wallet/state/walletRegistryStore';
import { walletRegistryService } from '@features/wallet/service/walletRegistryService';
import { networkStore } from '@features/network/state/networkStore';
import { tokenPriceStore } from '@features/tokens/price/state/tokenPriceStore';
import { CHAIN_ID_TO_FAMILY, toMoralisChain } from '@src/shared/config/chain/constants';
import { stockForexService } from '@features/wallet/service/stockForexService';

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

      const { mnemonic: savedMnemonic, saved, instances } = await walletService.init(mnemonic, opts);

      // Auto-enable stock and forex tokens (first time only)
      try {
        console.log('====== CALLING STOCK/FOREX SERVICE ======');
        await stockForexService.enableStockAndForexTokens();
        console.log('====== STOCK/FOREX SERVICE COMPLETED ======');
      } catch (e) {
        console.error('WALLET STORE - Stock/Forex service failed:', e);
        log.warn('Failed to auto-enable stock/forex tokens', { message: e?.message });
      }

      const assembled = [];
      const registeredByChain = Object.create(null); // avoid double register per chain

      // Iterate chains safely
      // eslint-disable-next-line guard-for-in
      for (const chain in saved) {
        if (!Object.prototype.hasOwnProperty.call(saved, chain)) continue;

        const inst = instances[chain];
        const metas = saved[chain];                  // wallets on this chain (addresses)

        // First seed defaults, then get actual list (which includes stock/forex tokens)
        walletRegistryStore.list(chain); // This seeds defaults
        const tokens = walletRegistryService.list(chain) || []; // Get actual current list

        // Debug log for token assembly
        console.log(`==== walletStore.init: Processing chain ${chain} ====`);
        console.log('Tokens from registry:', {
          total: tokens.length,
          stockTokens: tokens.filter(t => t.type === 'stock').length,
          forexTokens: tokens.filter(t => t.type === 'forex').length,
          solanaXTokens: tokens.filter(t => t.chainName === 'SOLANA X' || t.tag === 'SOLANA X').length,
          defaultTokens: tokens.filter(t => ['XUSDT', 'JYB', 'SLX', 'BTC', 'ETH', 'DOGE', 'LTC', 'USDC'].includes(t.symbol)).length,
          examples: tokens.slice(0, 10).map(t => ({ symbol: t.symbol, type: t.type, chainName: t.chainName, tag: t.tag })),
        });
        console.log('Wallet addresses (metas):', metas?.length || 0);

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
            // For Solana: ONLY add tokens that user actually has (with balance)
            // Don't add all tokens from registry
            if (Array.isArray(tokens) && chain !== 'solana') {
              for (let t = 0; t < tokens.length; t++) {
                const tokenAsset = this._toTokenAsset(chain, m?.address, tokens[t]);
                if (tokenAsset) assembled.push(tokenAsset);
              }
            }

            // Fallback: For SLX chain, always ensure MEX token is present
            if (chain === 'slx') {
              const hasMEX = assembled.some(a => a.chain === 'slx' && a.symbol === 'MEX');
              if (!hasMEX) {
                console.log('🔧 SLX fallback: Force-injecting MEX token');
                const mexToken = {
                  symbol: 'MEX',
                  address: '0x1F68B599E176350b920beFd12ceCAd799AfA47A0',
                  contractAddress: '0x1F68B599E176350b920beFd12ceCAd799AfA47A0',
                  decimals: 18,
                  label: 'META X',
                  name: 'META X',
                  logo: 'https://i.postimg.cc/2yWz40wQ/xusdt2.png',
                  type: 'token',
                  chainId: 781234,
                };
                const mexAsset = this._toTokenAsset(chain, m?.address, mexToken);
                if (mexAsset) assembled.push(mexAsset);
              }
            }
          }
        }

        // Special case: For Solana, ONLY show specific default tokens without wallet address
        // This ensures XUSDT, JYB, SLX, etc. are visible in Assets tab
        if (chain === 'solana' && Array.isArray(tokens)) {
          const defaultTokenSymbols = ['XUSDT', 'JYB', 'SLX', 'BTC', 'ETH', 'DOGE', 'LTC', 'USDC'];

          // Only include: 8 default tokens + stock + forex
          const defaultTokens = tokens.filter(t =>
            defaultTokenSymbols.includes(t.symbol) ||
            t.type === 'stock' ||
            t.type === 'forex'
          );

          console.log(`Adding ${defaultTokens.length} default Solana tokens (with wallet address for monitoring)`);
          console.log('Default tokens:', defaultTokens.map(t => ({ symbol: t.symbol, type: t.type, tag: t.tag })));

          // Use first wallet address for all default tokens (for monitoring purposes)
          const mainWalletAddress = metas?.[0]?.address;

          for (let t = 0; t < defaultTokens.length; t++) {
            const tokenAsset = this._toTokenAsset(chain, mainWalletAddress, defaultTokens[t]);
            if (tokenAsset) {
              assembled.push(tokenAsset);
            }
          }
        }
      }

      // ======== Force-inject SLX chain + MEX token if not derived ========
      if (!saved['slx'] || !Array.isArray(saved['slx']) || saved['slx'].length === 0) {
        // SLX uses same EVM derivation path as Ethereum, so address is identical
        const ethAddr = saved['ethereum']?.[0]?.address;
        if (ethAddr) {
          console.log('🔧 SLX chain not derived — force-injecting from ETH address:', ethAddr);
          saved['slx'] = [{ address: ethAddr, path: "m/44'/60'/0'/0/0", tag: 'SLX Network', createdAt: Date.now() }];

          // Build SLX wallet instance if possible
          try {
            const ethInfo = Object.values(instances).find(i => i); // grab any EVM instance's private key
            const slxCfg = networkStore.getConfig('slx');
            if (slxCfg) {
              // Build native SLX asset
              const slxNative = this._toNativeAsset('slx', { address: ethAddr });
              if (slxNative) {
                assembled.push(slxNative);
                console.log('✅ SLX native asset injected');
              }

              // Build MEX token asset
              const mexMeta = {
                symbol: 'MEX',
                address: '0x1F68B599E176350b920beFd12ceCAd799AfA47A0',
                contractAddress: '0x1F68B599E176350b920beFd12ceCAd799AfA47A0',
                decimals: 18,
                label: 'META X',
                name: 'META X',
                logo: 'https://i.postimg.cc/2yWz40wQ/xusdt2.png',
                type: 'token',
                chainId: 781234,
              };
              const mexAsset = this._toTokenAsset('slx', ethAddr, mexMeta);
              if (mexAsset) {
                assembled.push(mexAsset);
                console.log('✅ MEX token asset injected');
              }
            }
          } catch (e) {
            console.warn('SLX force-inject instance build failed:', e?.message);
          }
        }
      }
      // ======== End SLX force-inject ========

      // Persist state
      this.data = saved;
      this.instances = instances;
      this.assets = assembled;

      // Debug final assembled assets
      console.log('==== walletStore.init: Final assembled assets ====');
      console.log('Total assets:', assembled.length);
      console.log('Assets with type property:', assembled.filter(a => a.type).map(a => ({ symbol: a.symbol, type: a.type, chain: a.chain })));
      console.log('Stock assets:', assembled.filter(a => a.type === 'stock').length);
      console.log('Forex assets:', assembled.filter(a => a.type === 'forex').length);
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
    const chain = CHAIN_ID_TO_FAMILY[chainId];
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

    // Special mapping for Solana X tokens to use real asset prices
    const SOLANA_X_PRICE_MAP = {
      'XUSDT': 'USDTUSDT',  // Tether AC -> USDT price
      'BTC': 'BTCUSDT',     // Bitcoin Solana X -> BTC price
      'ETH': 'ETHUSDT',     // Ethereum Solana X -> ETH price
      'LTC': 'LTCUSDT',     // Litecoin Solana X -> LTC price
      'DOGE': 'DOGEUSDT',   // Dogecoin Solana X -> DOGE price
      'USDC': 'USDCUSDT',   // USDC Solana X -> USDC price
    };

    // Solana X token contract addresses (lowercase)
    const SOLANA_X_ADDRESSES = [
      'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4', // XUSDT
      '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf', // BTC
      '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell', // ETH
      'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a', // LTC
      '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd', // DOGE
      '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh', // USDC
    ];

    // Check if this is a Solana X token - check multiple possible address fields
    const contractAddr = (
      a?.tokenAddress ||
      a?.address ||
      a?.mint ||
      a?.contractAddress ||
      ''
    ).toLowerCase();

    const isSolanaXToken = SOLANA_X_ADDRESSES.includes(contractAddr);

    // Also check by symbol + chain for Solana X tokens
    const isSolanaChain = a?.chain === 'solana' || a?.chainId === 'solana';
    const isSolanaXBySymbol = isSolanaChain && SOLANA_X_PRICE_MAP[a?.symbol];

    let key;
    if ((isSolanaXToken || isSolanaXBySymbol) && SOLANA_X_PRICE_MAP[a.symbol]) {
      // Use mapped price for Solana X tokens
      key = SOLANA_X_PRICE_MAP[a.symbol];
    } else if (a.symbol === 'USDT' || a.symbol === 'XUSDT') {
      // USDT and XUSDT should use USDT price
      key = 'USDTUSDT';
    } else {
      key = a.symbol + 'USDT';
    }

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

    const chainId = net.chainId;
    const symbol = net.symbol || String(chain).toUpperCase();
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
      tag: chain // Native SOL stays as "solana"
    };
  },

  _toTokenAsset(chain, walletAddress, tokenMeta) {
    const net = networkStore.getConfig(chain);
    if (!net) return null;

    const chainId = tokenMeta?.chainId ?? net.chainId;
    const symbol = tokenMeta?.symbol;
    // Don't lowercase Solana addresses - they are case-sensitive base58
    const isSolana = chain === 'solana' || chainId === 'solana';
    const tokenAddr = isSolana
      ? String(tokenMeta?.address || tokenMeta?.contractAddress || '')
      : String(tokenMeta?.address || tokenMeta?.contractAddress || '').toLowerCase();
    const walletAddrL = String(walletAddress || '');

    if (!symbol || !tokenAddr) return null;

    const decimals = Number(tokenMeta?.decimals ?? 18);
    // Include walletAddr in id to differentiate the same token across multiple wallets
    // For default tokens without wallet address, use 'default' as identifier
    const walletIdentifier = walletAddress || 'default';
    const id = `${String(chainId).toLowerCase()}:${String(symbol).toLowerCase()}:${tokenAddr.toLowerCase()}:${walletIdentifier}`;

    // Icon key for tokenIconStore (without wallet identifier)
    const iconKey = `${String(chainId).toLowerCase()}:${String(symbol).toLowerCase()}:${tokenAddr.toLowerCase()}`;

    // Tokens that should have "SOLANA X" tag
    const solanaXTokens = ['JYB', 'XUSDT', 'SLX', 'BTC', 'ETH', 'DOGE', 'USDC', 'LTC'];
    const stockTokens = ['AMZN', 'GOOG', 'TSLA', 'AAPL'];
    const forexTokens = ['CNYUSD'];

    // Check if token already has SOLANA X tag/chainName from metadata
    const hasSOLANAXTag = tokenMeta?.tag === 'SOLANA X' || tokenMeta?.chainName === 'SOLANA X';

    // Only specific tokens should have SOLANA X tag
    const isSolanaX = chain === 'solana' && (
      solanaXTokens.includes(symbol.toUpperCase()) ||
      stockTokens.includes(symbol.toUpperCase()) ||
      forexTokens.includes(symbol.toUpperCase()) ||
      hasSOLANAXTag
    );

    return {
      id,
      iconKey, // Add iconKey for logo lookup
      isToken: true,
      chain,
      chainId,
      symbol,
      decimals,
      tokenAddress: tokenAddr,
      address: walletAddrL || undefined,
      networkLogoUrl: net.logoUrl,
      tag: isSolanaX ? 'SOLANA X' : chain,
      label: tokenMeta?.label || null,
      logo: tokenMeta?.logo || null,
      type: tokenMeta?.type || 'token', // 'token' | 'stock' | 'forex'
      balance: '0', // Default balance for tokens without wallet
      balanceFormatted: '0',
      balanceUsd: 0,
    };
  },
  getInstance(chain) {
    return this.instances[chain];
  },

  async sendTransaction({ chain, to, amount, tokenAddress = null, platformFee }) {
    console.log('💸 [walletStore] sendTransaction called:', {
      chain,
      to: to?.slice(0, 8) + '...',
      amount,
      tokenAddress: tokenAddress ? tokenAddress.slice(0, 8) + '...' : 'native',
    });

    const wallet = this.getInstance(chain);
    if (!wallet) {
      console.error('❌ [walletStore] No wallet instance for chain:', chain);
      throw new Error('No active wallet selected');
    }

    console.log('✅ [walletStore] Wallet instance found, building intent...');

    const intent = {
      kind: tokenAddress ? 'tokenTransfer' : 'nativeTransfer',
      to,
      amount,
      tokenAddress: tokenAddress || null,
      platformFee: platformFee || null,
    };

    console.log('📦 [walletStore] Intent:', intent);

    let txid;
    try {
      if (typeof wallet.submit === 'function') {
        console.log('🚀 [walletStore] Using wallet.submit()...');
        const result = await wallet.submit(intent);
        txid = result.txid;
      } else if (!tokenAddress && typeof wallet.sendNative === 'function') {
        console.log('🚀 [walletStore] Using wallet.sendNative()...');
        txid = await wallet.sendNative(to, amount, { platformFee });
      } else if (tokenAddress && typeof wallet.sendToken === 'function') {
        console.log('🚀 [walletStore] Using wallet.sendToken()...');
        txid = await wallet.sendToken(tokenAddress, to, amount, { platformFee });
      } else if (typeof wallet.sendTransaction === 'function') {
        console.log('🚀 [walletStore] Using wallet.sendTransaction()...');
        txid = await wallet.sendTransaction({ to, amount, tokenAddress, platformFee });
      } else {
        console.error('❌ [walletStore] No send method available on wallet');
        throw new Error('sendTransaction not implemented for this wallet');
      }

      console.log('✅ [walletStore] Transaction sent! TxID:', txid?.slice(0, 16) + '...');
    } catch (sendError) {
      console.error('❌ [walletStore] Transaction failed:', sendError);
      throw sendError;
    }

    // Trigger push notification immediately after successful send
    try {
      console.log('🔔 [walletStore] Triggering outgoing notification...');
      const { transactionMonitorService } = await import('@features/notifications/service/transactionMonitorService');

      // Find the asset to get symbol
      const asset = this.assets.find(a =>
        a.chain === chain &&
        (tokenAddress ? a.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase() : !a.isToken)
      );
      const symbol = asset?.symbol || 'TOKEN';

      console.log('🔔 [walletStore] Notification details:', {
        type: 'outgoing',
        amount: String(amount),
        symbol,
        to: to.slice(0, 8) + '...',
        txHash: txid.slice(0, 8) + '...',
        chain,
      });

      await transactionMonitorService.notifyTransaction({
        type: 'outgoing',
        amount: String(amount),
        symbol,
        to,
        txHash: txid,
        chain,
      });

      console.log('✅ [walletStore] Outgoing notification sent successfully');
    } catch (notifError) {
      // Don't fail the transaction if notification fails
      console.error('❌ [walletStore] Failed to send transaction notification:', notifError);
      log.warn('walletStore.sendTransaction notification failed', { message: notifError?.message });
    }

    return { chain: wallet.chainId || 'unknown', txid };
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
        chain: toMoralisChain(chain)
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
