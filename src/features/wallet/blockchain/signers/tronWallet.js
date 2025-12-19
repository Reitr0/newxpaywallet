// src/features/wallet/api/tronWallet.js
import { TronWeb } from 'tronweb';
import { BaseWallet } from '@src/features/wallet/blockchain/signers/baseWallet';
import { WalletError } from '@src/features/wallet/blockchain/type/types';
import {
  clamp,
  formatUnits,
  fromSun,
  parseUnits,
  percentOf,
  toBigIntHex,
  toBigIntSafe,
  toSun,
  ZERO,
} from '@src/shared/lib/math/tronMath';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';
import { createHttpClient } from '@src/shared/infra/http/httpClient';

/* ------------------------- helpers (unchanged) ------------------------- */

// Rough bandwidth estimate from raw_data_hex
const estimateBandwidthBytes = (unsignedTx) => {
  const hex = unsignedTx?.raw_data_hex;
  if (typeof hex === 'string' && hex.startsWith('0x')) return Math.ceil((hex.length - 2) / 2);
  if (typeof hex === 'string') return Math.ceil(hex.length / 2);
  return 200; // fallback
};

// energy_used from trigger response
const energyUsedFromTrigger = (resp) => {
  if (typeof resp?.energy_used === 'number') return resp.energy_used;
  const ret = resp?.transaction?.ret;
  if (Array.isArray(ret) && typeof ret[0]?.energy_used === 'number') return ret[0].energy_used;
  return 50_000; // conservative default for TRC20 transfer
};

/* ============================== TronWallet ==============================
deps = {
  fullHost: string,                 // RPC endpoint
  chainId: string,                  // 'tron' | 'tron-testnet'
  label: string,                    // 'Tron Mainnet'...
  explorerBaseUrl?: string,         // tx explorer base
  explorerAddressBase?: string,     // address explorer base
  networkLogoUrl?: string,
  getPrivateKey: (index:number)=>Promise<string>,
  // Optional:
  apiKey?: string                   // TronGrid API key header
}
========================================================================= */

export default class TronWallet extends BaseWallet {
  constructor(deps) {
    super();
    this.deps = deps;
    const { fullHost, apiKey } = deps;

    this.tron = new TronWeb({
      fullHost,
      headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : undefined,
    });
    this._index = 0;
    this._pkHexNo0x = null;

    /** token registry (per wallet instance)
     *  map: contractLowerCase -> { address, symbol, decimals, name? }
     */
    this._tokens = new Map();
  }

  /* --------------------------- token registry --------------------------- */

  async registerToken(meta) {
    const address = String(meta.address || meta.token || '').trim();
    if (!address) throw new WalletError('INVALID_TOKEN', 'Missing TRC-20 contract address');
    const key = address.toLowerCase();

    // fill decimals/symbol by introspection if missing
    let decimals = meta.decimals;
    let symbol = meta.symbol;
    try {
      const c = await this.tron.contract().at(address);
      if (decimals == null) {
        try {
          const d = await c.decimals().call();
          const n = Number((typeof d === 'object' ? d?.toString?.() : d));
          if (Number.isFinite(n) && n >= 0 && n <= 36) decimals = n;
        } catch {}
      }
      if (!symbol) {
        try {
          const s = await c.symbol().call();
          symbol = (typeof s === 'string' ? s : s?.toString?.()) || 'TRC20';
        } catch {}
      }
    } catch {
      // silent; allow manual meta if contract lookup fails
    }

    this._tokens.set(key, {
      address,
      symbol: symbol || 'TRC20',
      decimals: Number(decimals ?? 6),
      name: meta.name || '',
    });
  }

  unregisterToken(addressOrToken) {
    const k = String(addressOrToken || '').toLowerCase();
    this._tokens.delete(k);
  }

  listTokens() {
    return Array.from(this._tokens.values());
  }

  async #resolveTokenMeta(addressOrToken, { allowLazy = true } = {}) {
    const key = String(addressOrToken || '').toLowerCase();
    if (!key) throw new WalletError('INVALID_TOKEN', 'Invalid TRC-20 contract address');
    const known = this._tokens.get(key);
    if (known) return known;

    if (!allowLazy) throw new WalletError('UNKNOWN_TOKEN', 'Token not registered');

    // Lazy contract introspection
    let decimals = 6;
    let symbol = 'TRC20';
    try {
      const c = await this.tron.contract().at(addressOrToken);
      try {
        const d = await c.decimals().call();
        const n = Number((typeof d === 'object' ? d?.toString?.() : d));
        if (Number.isFinite(n) && n >= 0 && n <= 36) decimals = n;
      } catch {}
      try {
        const s = await c.symbol().call();
        symbol = (typeof s === 'string' ? s : s?.toString?.()) || symbol;
      } catch {}
    } catch {}
    const meta = { address: addressOrToken, symbol, decimals };
    // Optionally cache:
    // this._tokens.set(key, meta);
    return meta;
  }

  /* --------------------------------- info -------------------------------- */

  info() {
    return {
      chainId: this.deps.chainId,
      kind: CHAIN_ID_TO_FAMILY[this.deps.chainId],
      label: this.deps.label,
      symbol: 'TRX',
      decimals: 6,
      explorerBaseUrl: this.deps.explorerBaseUrl,
      explorerAddressBase: this.deps.explorerAddressBase,
      networkLogoUrl: this.deps.networkLogoUrl,
    };
  }

  capabilities() {
    return {
      nativeTransfer: true,
      tokenTransfer: true,
      contractCall: true,
      psbt: false,
      messageSign: ['tron'],
    };
  }

  /* -------------------------------- guards -------------------------------- */

  #ensureCapabilities(intent) {
    if (!['nativeTransfer', 'tokenTransfer'].includes(intent.kind)) {
      throw new WalletError('NOT_SUPPORTED', `Unsupported intent: ${intent.kind}`);
    }
  }

  /* ------------------------------- internals ------------------------------ */

  async #ensurePk() {
    if (this._pkHexNo0x) return;
    let pk = await this.deps.getPrivateKey(this._index);
    if (typeof pk !== 'string') throw new WalletError('INTERNAL', 'Tron private key must be a string');
    this._pkHexNo0x = pk.startsWith('0x') ? pk.slice(2) : pk;
  }

  async #address() {
    await this.#ensurePk();
    return this.tron.address.fromPrivateKey(this._pkHexNo0x);
  }

  async #getAccountResources(address) {
    try {
      const r = await this.tron.trx.getAccountResources(address);
      return {
        freeNetLimit: Number(r?.freeNetLimit ?? 0),
        freeNetUsed:  Number(r?.freeNetUsed ?? 0),
        NetLimit:     Number(r?.NetLimit ?? 0),
        NetUsed:      Number(r?.NetUsed ?? 0),
        EnergyLimit:  Number(r?.EnergyLimit ?? 0),
        EnergyUsed:   Number(r?.EnergyUsed ?? 0),
      };
    } catch {
      return { freeNetLimit: 0, freeNetUsed: 0, NetLimit: 0, NetUsed: 0, EnergyLimit: 0, EnergyUsed: 0 };
    }
  }

  async #getChainParamSun(key, fallback) {
    try {
      const params = await this.tron.trx.getChainParameters();
      const found = params.find(p => p.key?.toLowerCase() === key.toLowerCase());
      const v = found?.value;
      if (typeof v === 'number' && Number.isFinite(v)) return BigInt(v);
    } catch {}
    return BigInt(fallback);
  }

  /* -------------------------------- accounts ------------------------------ */

  async listAccounts() { return [{ index: this._index, address: await this.#address() }]; }
  async useAccount(index) { this._index = index; this._pkHexNo0x = null; await this.#ensurePk(); }
  async activeAccount() { return { index: this._index, address: await this.#address() }; }

  /* -------------------------------- balances ------------------------------ */

  async getNativeBalance() {
    const addr = await this.#address();
    const sun = toBigIntSafe(await this.tron.trx.getBalance(addr));
    return { total: fromSun(sun), decimals: 6, symbol: 'TRX' };
  }

  async getTokenBalance(tokenAddress) {
    const meta = await this.#resolveTokenMeta(tokenAddress, { allowLazy: true });
    const addr = await this.#address();

    // balanceOf(address)
    const res = await this.tron.transactionBuilder.triggerSmartContract(
      meta.address,
      'balanceOf(address)',
      {},
      [{ type: 'address', value: addr }],
      addr
    );
    const hex = res?.constant_result?.[0] ?? '0x0';
    const raw = toBigIntHex(hex);

    return { total: formatUnits(raw, meta.decimals), decimals: meta.decimals, symbol: meta.symbol };
  }

  /* -------------------------------- estimate ------------------------------- */

  async estimate(intent) {
    this.#ensureCapabilities(intent);

    const isToken = intent.kind === 'tokenTransfer';
    const from = await this.#address();

    // Resolve token context if needed
    let tokenMeta = null;
    if (isToken) {
      const which = intent.token || intent.tokenAddress;
      if (!which) throw new WalletError('INVALID_ARG', 'token is required for TRC-20 transfer');
      tokenMeta = await this.#resolveTokenMeta(which, { allowLazy: true });
    }

    // Normalize amount in SEND-ASSET base units
    const amountRaw = isToken
      ? parseUnits(intent.amount ?? 0, tokenMeta.decimals)
      : toSun(intent.amount ?? 0);

    // Platform fee (SEND-ASSET units)
    const pf = intent.platformFee || null;
    let platformFeeRaw = ZERO;
    if (pf?.receiver) {
      if (pf.percent != null) platformFeeRaw += percentOf(amountRaw, pf.percent);
      if (pf.fixed != null)   platformFeeRaw += isToken ? parseUnits(pf.fixed, tokenMeta.decimals) : toSun(pf.fixed);
    }
    const willReduceAmount = pf?.mode === 'subtract' || intent.applyPlatformFeeByReducingAmount === true;

    const totalAmountSend = amountRaw;
    const actualReceive   = willReduceAmount ? (amountRaw > platformFeeRaw ? amountRaw - platformFeeRaw : ZERO) : amountRaw;

    // Draft transaction to measure bandwidth & energy
    let draft;
    let energyUsed = 0;

    if (isToken) {
      const r = await this.tron.transactionBuilder.triggerSmartContract(
        tokenMeta.address,
        'transfer(address,uint256)',
        { feeLimit: 15_000_000 },
        [
          { type: 'address', value: intent.to },
          { type: 'uint256', value: amountRaw.toString(10) },
        ],
        from
      );
      draft = r?.transaction;
      energyUsed = energyUsedFromTrigger(r);
    } else {
      draft = await this.tron.transactionBuilder.sendTrx(intent.to, Number(amountRaw), from);
      energyUsed = 0; // native TRX: bandwidth only
    }
    const bandwidthBytes = estimateBandwidthBytes(draft);

    // Resources & chain params
    const res = await this.#getAccountResources(from);
    const freeBW = Math.max((res.freeNetLimit - res.freeNetUsed), 0);
    const frozenBW = Math.max((res.NetLimit - res.NetUsed), 0);
    const bandwidthLeft = freeBW + frozenBW;

    const energyLeft = Math.max((res.EnergyLimit - res.EnergyUsed), 0);

    const ENERGY_PRICE_SUN     = await this.#getChainParamSun('ENERGY_FEE', 420);
    const BANDWIDTH_PRICE_SUN  = await this.#getChainParamSun('TRANSACTION_FEE', 100);

    const bwShortfall = Math.max(bandwidthBytes - bandwidthLeft, 0);
    const enShortfall = Math.max(energyUsed - energyLeft, 0);

    // NOTE: TRON charges SUN for shortfalls; both terms priced in SUN
    const bwFeeSun = toBigIntSafe(bwShortfall) * BANDWIDTH_PRICE_SUN;
    const enFeeSun = toBigIntSafe(enShortfall) * ENERGY_PRICE_SUN;
    const feeSun   = bwFeeSun + enFeeSun;

    return {
      chain: this.deps.chainId,
      currency: isToken ? tokenMeta.symbol : 'TRX',
      amount: isToken ? formatUnits(amountRaw, tokenMeta.decimals) : fromSun(amountRaw),
      fee: fromSun(feeSun),
      feeUnit: 'TRX',
      details: {
        chainId: this.deps.chainId,
        kind: isToken ? 'tokenTransfer' : 'nativeTransfer',

        // network fee (native)
        networkFeeRaw: feeSun.toString(10),
        networkFeeHuman: fromSun(feeSun),

        // token context
        token: isToken ? {
          address: tokenMeta.address,
          symbol: tokenMeta.symbol,
          decimals: String(tokenMeta.decimals),
        } : null,

        // resources
        bandwidthBytes,
        bandwidthLeft,
        bandwidthShortfall: bwShortfall,
        energyUsed,
        energyLeft,
        energyShortfall: enShortfall,
        energyPriceSun: ENERGY_PRICE_SUN.toString(10),
        bandwidthPriceSun: BANDWIDTH_PRICE_SUN.toString(10),

        // platform fee (SEND-ASSET)
        platformFeeRaw: platformFeeRaw.toString(10),
        platformFeeHuman: isToken ? formatUnits(platformFeeRaw, tokenMeta.decimals) : fromSun(platformFeeRaw),
        willReduceAmount,

        // totals (SEND-ASSET human)
        totalAmountSend: isToken ? formatUnits(totalAmountSend, tokenMeta.decimals) : fromSun(totalAmountSend),
        actualReceive:   isToken ? formatUnits(actualReceive,   tokenMeta.decimals) : fromSun(actualReceive),

        note: 'Fee is charged only when bandwidth/energy are insufficient; values are estimates.',
      },
    };
  }

  /* --------------------------------- build --------------------------------- */

  async build(intent) {
    this.#ensureCapabilities(intent);
    await this.#ensurePk();
    const from = await this.#address();

    const isToken = intent.kind === 'tokenTransfer';
    let tokenMeta = null;
    if (isToken) {
      const which = intent.token || intent.tokenAddress;
      if (!which) throw new WalletError('INVALID_ARG', 'token is required for TRC-20 transfer');
      tokenMeta = await this.#resolveTokenMeta(which, { allowLazy: true });
    }

    // amount base units
    const amountRaw = isToken
      ? parseUnits(intent.amount ?? 0, tokenMeta.decimals)
      : toSun(intent.amount ?? 0);

    // platform fee in SEND-ASSET units
    const pf = intent.platformFee || null;
    let platformFeeRaw = ZERO;
    if (pf?.receiver) {
      if (pf.percent != null) platformFeeRaw += percentOf(amountRaw, pf.percent);
      if (pf.fixed != null)   platformFeeRaw += isToken ? parseUnits(pf.fixed, tokenMeta.decimals) : toSun(pf.fixed);
    }

    const willSubtract = pf?.mode === 'subtract' || intent.applyPlatformFeeByReducingAmount === true;
    const sendRawFinal = willSubtract
      ? (amountRaw > platformFeeRaw ? amountRaw - platformFeeRaw : ZERO)
      : amountRaw;

    const tron = this.tron;
    let mainUnsigned;

    if (!isToken) {
      // TRX
      mainUnsigned = await tron.transactionBuilder.sendTrx(intent.to, Number(sendRawFinal), from);
    } else {
      // draft for energy estimate
      const draft = await tron.transactionBuilder.triggerSmartContract(
        tokenMeta.address,
        'transfer(address,uint256)',
        { feeLimit: 15_000_000 },
        [
          { type: 'address', value: intent.to },
          { type: 'uint256', value: sendRawFinal.toString(10) },
        ],
        from
      );
      if (!draft?.transaction) throw new WalletError('INTERNAL', 'TRC20 transfer build failed');

      const res = await this.#getAccountResources(from);
      const energyLeft = Math.max((res.EnergyLimit - res.EnergyUsed), 0);
      const used = energyUsedFromTrigger(draft);
      const need = Math.max(used - energyLeft, 0);

      const ENERGY_PRICE_SUN = await this.#getChainParamSun('ENERGY_FEE', 420);
      const neededSun = toBigIntSafe(Math.floor(need * 1.25)) * ENERGY_PRICE_SUN; // +25% buffer
      const baseLimit = BigInt(5_000_000);   // 5 TRX
      const maxLimit  = BigInt(100_000_000); // 100 TRX
      const feeLimit  = clamp(neededSun + baseLimit, baseLimit, maxLimit);

      const r = await tron.transactionBuilder.triggerSmartContract(
        tokenMeta.address,
        'transfer(address,uint256)',
        { feeLimit: Number(feeLimit) },
        [
          { type: 'address', value: intent.to },
          { type: 'uint256', value: sendRawFinal.toString(10) },
        ],
        from
      );
      if (!r?.transaction) throw new WalletError('INTERNAL', 'TRC20 transfer (final) build failed');
      mainUnsigned = r.transaction;
    }

    // Done if subtracting OR no platform fee
    if (willSubtract || !pf?.receiver || platformFeeRaw === ZERO) {
      return mainUnsigned;
    }

    // Separate platform-fee tx
    let feeUnsigned;
    if (isToken) {
      const r = await tron.transactionBuilder.triggerSmartContract(
        tokenMeta.address,
        'transfer(address,uint256)',
        { feeLimit: 5_000_000 },
        [
          { type: 'address', value: pf.receiver },
          { type: 'uint256', value: platformFeeRaw.toString(10) },
        ],
        from
      );
      if (!r?.transaction) throw new WalletError('INTERNAL', 'TRC20 platform-fee build failed');
      feeUnsigned = r.transaction;
    } else {
      feeUnsigned = await tron.transactionBuilder.sendTrx(pf.receiver, Number(platformFeeRaw), from);
    }

    return [mainUnsigned, feeUnsigned];
  }

  /* ---------------------------------- sign --------------------------------- */

  async sign(unsignedTxOrArray) {
    await this.#ensurePk();
    const tron = new TronWeb({ fullHost: this.deps.fullHost });
    tron.setPrivateKey(this._pkHexNo0x);

    const signOne = async (u) => {
      const signed = await tron.trx.sign(u);
      return { kind: 'tx', raw: signed };
    };

    if (Array.isArray(unsignedTxOrArray)) {
      const out = [];
      for (const u of unsignedTxOrArray) out.push(await signOne(u));
      return out;
    }
    return await signOne(unsignedTxOrArray);
  }

  /* ---------------------------------- send --------------------------------- */

  async send(signedOrArray) {
    const sendOne = async (signed) => {
      if (!signed || signed.kind !== 'tx') {
        throw new WalletError('NOT_SUPPORTED', 'send expects { kind:"tx", raw }');
      }
      const res = await this.tron.trx.sendRawTransaction(signed.raw);
      if (!res || res.result === false) {
        throw new WalletError('NETWORK', res?.message || 'Broadcast failed');
      }
      return res.txid ?? JSON.stringify(res);
    };

    if (Array.isArray(signedOrArray)) {
      const hashes = [];
      for (const s of signedOrArray) hashes.push(await sendOne(s));
      return hashes;
    }
    return await sendOne(signedOrArray);
  }

  /* ------------------------------- messages -------------------------------- */

  async signMessage() {
    throw new WalletError('NOT_SUPPORTED', 'Tron message signing not implemented here');
  }

  on() { return () => {}; }

  /**
   * Get TRX / TRC20 transaction history for the active account.
   *
   * Args:
   *  - address?: string (defaults to active)
   *  - tokenAddress?: string (TRC20 contract address)
   *  - limit?: number (default 20)
   *  - cursor?: string (TronGrid "fingerprint" for pagination)
   *
   * Returns:
   *  { items: Array<{
   *      hash, direction: 'in'|'out', value, symbol, timestamp, explorerUrl,
   *      blockNumber?, status?, from?, to?
   *    }>, cursor?: string }
   */
  async getTransactionHistory({ address, tokenAddress, limit = 20, cursor } = {}) {
    await this.#ensurePk();
    const activeAddr = address || (await this.#address());
    if (tokenAddress) {
      return await this.getTrc20(activeAddr, { tokenAddress, limit, cursor });
    }
    return await this.getNative(activeAddr, { limit, cursor });
  }
  async getNative(address, { limit = 20, cursor } = {}) {
    const { data } = await this.deps.txHistoryProvider.get(
      `/v1/accounts/${address}/transactions`,
      {
        params: {
          limit,
          fingerprint: cursor,
          only_confirmed: true,
          order_by: 'block_timestamp,desc',
        },
      }
    );

    const rows = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.result)
        ? data.result
        : [];

    const items = rows.map((t) => {
      const hash = t.txID || t.transaction_id;
      const ct = (t.raw_data?.contract || [])[0];
      const type = ct?.type;

      let direction = 'out';
      let value = '0';
      let from;
      let to;

      const ts = t.block_timestamp
        ? new Date(Number(t.block_timestamp)).toISOString()
        : undefined;

      const status =
        t.ret && t.ret[0]?.contractRet
          ? t.ret[0].contractRet === 'SUCCESS'
            ? 'success'
            : 'failed'
          : undefined;

      if (type === 'TransferContract') {
        const p = ct.parameter?.value || {};
        const fromB58 =
          p.owner_address_base58 ||
          p.owner_address ||
          t.owner_address_base58 ||
          t.ownerAddressBase58;
        const toB58 =
          p.to_address_base58 ||
          p.to_address ||
          t.to_address_base58 ||
          t.toAddressBase58;

        from = fromB58;
        to = toB58;
        direction = to === address ? 'in' : 'out';

        // TRX has 6 decimals (Sun)
        const suns = toBigIntSafe(p.amount ?? 0);
        value = formatUnits(suns, 6);
      }

      return {
        hash,
        direction,
        value,
        symbol: 'TRX',
        timestamp: ts,
        explorerUrl: this.makeTxUrl(this.deps.explorerBaseUrl, hash),
        from,
        to,
        status,
        blockNumber: t.blockNumber ?? t.block_number,
      };
    });

    const nextCursor =
      data?.meta?.fingerprint || data?.fingerprint || data?.next_fingerprint;

    return { items, cursor: nextCursor };
  }

  /**
   * TRC-20 transfers for an address; optionally filter by token contract.
   */
  async getTrc20(address, { tokenAddress, limit = 20, cursor } = {}) {
    const { data } = await this.deps.txHistoryProvider.get(
      `/v1/accounts/${address}/transactions/trc20`,
      {
        params: {
          limit,
          fingerprint: cursor,
          contract_address: tokenAddress, // optional filter
          order_by: 'block_timestamp,desc',
        },
      }
    );

    const rows = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.result)
        ? data.result
        : [];

    const items = rows.map((x) => {
      const hash = x.transaction_id || x.txid;

      const from = x.from || x.from_address;
      const to   = x.to   || x.to_address;

      // normalize direction relative to the queried address
      const direction =
        to === address ? 'in' : from === address ? 'out' : 'out';

      // decimals/symbol from token_info when available
      const decimals = Number(x.token_info?.decimals ?? x.decimals ?? 6);
      const raw = toBigIntSafe(x.value ?? x.amount ?? 0);
      const value = formatUnits(raw, Number.isFinite(decimals) ? decimals : 6);

      const timestamp = x.block_timestamp
        ? new Date(Number(x.block_timestamp)).toISOString()
        : undefined;

      // SUCCESS/failed if present (TronGrid field names can vary)
      const status = x.finalResult === 'SUCCESS'
        ? 'success'
        : x.finalResult
          ? 'failed'
          : undefined;

      return {
        hash,
        direction,
        value,
        symbol: x.token_info?.symbol || x.symbol || 'TRC20',
        timestamp,
        explorerUrl: this.makeTxUrl(this.deps.explorerBaseUrl, hash),
        from,
        to,
        status,
        blockNumber: x.block ?? x.blockNumber,
      };
    });

    const nextCursor =
      data?.meta?.fingerprint || data?.fingerprint || data?.next_fingerprint;

    return { items, cursor: nextCursor };
  }
  /**
   * Build a Tron explorer transaction URL.
   *
   * @param {string} explorerBaseUrl - Base explorer URL (e.g. "https://tronscan.org")
   * @param {string} hash - Transaction hash or ID
   * @returns {string|undefined} - Full transaction explorer URL, or undefined if missing
   */
  makeTxUrl(explorerBaseUrl, hash) {
    if (!explorerBaseUrl || !hash) return undefined;
    // Ensure no duplicate slashes and append standard Tronscan route
    return `${explorerBaseUrl.replace(/\/+$/, '')}/#/transaction/${hash}`;
  }

}
