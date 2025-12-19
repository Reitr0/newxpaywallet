// src/features/wallet/api/evmWallet.js
import { ethers, formatEther, formatUnits, getBytes, parseEther, parseUnits, Transaction, Wallet, } from 'ethers';

import { BaseWallet } from '@src/features/wallet/blockchain/signers/baseWallet';
import { WalletError } from '@src/features/wallet/blockchain/type/types';
import { etherToWei, ONE_GWEI, percentOf, unitToWei, weiToEth, weiToUnit, ZERO, } from '@src/shared/lib/math/evmMath';
import { evmProvider } from '@src/features/wallet/blockchain/providers/evmProvider';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';
import logService from '@src/shared/infra/log/logService';

// Minimal ERC-20 ABI
const ERC20_IFACE = new ethers.Interface([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address,uint256) returns (bool)',
]);

/**
 * deps = {
 *   rpcUrl: string,
 *   chainId: string | number, // e.g. 'ethereum' mapped by CHAIN_ID_TO_FAMILY, or numeric chainId
 *   chainIdNumber?: number,   // optional numeric chain id override (e.g., 11155111 for Sepolia)
 *   symbol: string,           // native symbol (ETH / BNB / MATIC)
 *   decimals: number,         // native decimals (usually 18)
 *   explorerBaseUrl?: string,
 *   networkLogoUrl?: string,
 *   label?: string,
 *   getPrivateKey: (index:number)=>Promise<string>, // must return 0x-prefixed 32-byte hex
 * }
 *
 * Token transfers use a runtime registry via:
 *   await evm.registerToken({ address, symbol, decimals, name? })
 *   evm.listTokens()
 *   evm.unregisterToken(address)
 */
export default class EvmWallet extends BaseWallet {
  constructor(deps) {
    super();
    this.deps = deps;
    this.provider = this.deps.provider;
    this._index = 0;
    this._wallet = null;

    /** address(lowercased) -> { address, symbol, decimals, name? } */
    this._tokens = new Map();
  }

  /* ----------------------------- Token registry ----------------------------- */

  /**
   * Explicitly register a token for UX (balances/transfers). Persist it in your app
   * via service/store and rehydrate by calling this again on startup.
   */
  async registerToken(meta) {
    const addr = String(meta.address || '').toLowerCase();
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      throw new WalletError('INVALID_TOKEN', 'registerToken requires a valid ERC-20 address');
    }
    this._tokens.set(addr, {
      address: meta.address,
      symbol: meta.symbol ?? '',
      decimals: Number(meta.decimals ?? 18),
      name: meta.name ?? '',
    });
  }

  unregisterToken(tokenAddress) {
    const addr = String(tokenAddress || '').toLowerCase();
    this._tokens.delete(addr);
  }

  listTokens() {
    return Array.from(this._tokens.values());
  }

  /** Resolve token meta from registry or (optionally) lazy-introspect on-chain. */
  async #resolveTokenMeta(tokenAddress, { allowLazy = true } = {}) {
    const addr = String(tokenAddress || '').toLowerCase();
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      throw new WalletError('INVALID_TOKEN', 'Invalid ERC-20 token address');
    }

    let meta = this._tokens.get(addr);
    if (meta) return meta;

    if (!allowLazy) {
      throw new WalletError('UNKNOWN_TOKEN', 'Token not registered');
    }

    // Lazy-load from chain (do NOT auto-store unless you want that behavior)
    const c = new ethers.Contract(tokenAddress, ERC20_IFACE.fragments, this.provider);
    const [dec, sym] = await Promise.all([c.decimals(), c.symbol()]);
    meta = { address: tokenAddress, symbol: sym, decimals: Number(dec) };
    // Optional: cache discovery
    // this._tokens.set(addr, meta);
    return meta;
  }

  /* --------------------------------- Info ---------------------------------- */

  info() {
    const { chainId, explorerBaseUrl, label, symbol, decimals, networkLogoUrl } = this.deps;
    return {
      chainId,
      kind: CHAIN_ID_TO_FAMILY[chainId],
      label: label ?? String(chainId),
      symbol,          // native symbol (ETH/BNB/MATIC)
      decimals,        // native decimals (18)
      explorerBaseUrl,
      networkLogoUrl,
    };
  }

  capabilities() {
    return {
      nativeTransfer: true,
      tokenTransfer: true,
      contractCall: true,
      psbt: false,
      messageSign: ['personal', 'typedData'],
    };
  }

  /* ------------------------------- Accounts -------------------------------- */

  /**
   * ✅ Return the latest block number on this EVM chain
   */
  async getBlockNumber() {
    try {
      return await this.provider.getBlockNumber();
    } catch (err) {
      throw err;
    }
  }
  /**
   * eth_estimateGas compatible helper
   * @param {object} tx { from, to, data?, value? }
   */
  async estimateGas(tx) {
    await this.#ensureWallet();
    if (!tx?.to) throw new WalletError('INVALID_TX', 'estimateGas requires tx.to');
    try {
      const est = await this.provider.estimateGas({
        ...tx,
        from: tx.from || this._wallet.address,
      });
      return ethers.toBigInt(est).toString();
    } catch (e) {
      throw new WalletError('GAS_ESTIMATE_FAILED', e?.reason || e?.message);
    }
  }

  /**
   * eth_call compatible helper
   * @param {object} tx { to, data, value? }
   * @returns {string} raw hex result
   */
  async call(tx) {
    await this.#ensureWallet();
    if (!tx?.to) throw new WalletError('INVALID_TX', 'call requires tx.to');
    try {
      const result = await this.provider.call({
        ...tx,
        from: tx.from || this._wallet.address,
      });
      return result;
    } catch (e) {
      throw new WalletError('CALL_FAILED', e?.reason || e?.message);
    }
  }

  /**
   * personal_sign helper (EIP-191)
   * @param {string} address must match active wallet
   * @param {string} message hex or utf8
   */
  async signPersonalMessage(address, message) {
    await this.#ensureWallet();
    const addrL = this._wallet.address.toLowerCase();
    if (addrL !== String(address).toLowerCase()) {
      throw new WalletError('INVALID_FROM', 'Signer address mismatch');
    }
    return await this._wallet.signMessage(getBytes(message));
  }

  /**
   * signTypedDataV4 helper (EIP-712)
   * @param {string} address must match active wallet
   * @param {string} typedJson JSON string
   */
  async signTypedDataV4(address, typedJson) {
    await this.#ensureWallet();
    const addrL = this._wallet.address.toLowerCase();
    if (addrL !== String(address).toLowerCase()) {
      throw new WalletError('INVALID_FROM', 'Signer address mismatch');
    }
    const parsed = JSON.parse(typedJson);
    const domain = parsed.domain || {};
    const types = parsed.types || {};
    const value = parsed.message || parsed.value || {};
    // ethers v6 signer supports directly
    return await this._wallet.signTypedData(domain, types, value);
  }

  /**
   * sendTransaction helper
   * @param {object} tx { from, to, data?, value?, gas?, gasPrice? }
   */
  async sendTransaction(tx) {
    await this.#ensureWallet();
    try {
      const txReq = {
        ...tx,
        from: undefined,
        value: tx.value ? BigInt(tx.value) : BigInt(0),
      };
      const response = await this._wallet.sendTransaction(txReq);
      return response.hash;
    } catch (e) {
      throw new WalletError('TX_SEND_FAILED', e?.reason || e?.message);
    }
  }
  async sendDappsTransaction(tx) {
    await this.#ensureWallet();
    try {
      const response = await this._wallet.sendTransaction(tx);
      return response.hash;
    } catch (e) {
      console.log(e)
      throw new WalletError('TX_SEND_FAILED', e?.reason || e?.message);
    }
  }
  async #ensureWallet() {
    if (this._wallet) return;
    const pk = await this.deps.getPrivateKey(this._index);
    if (typeof pk !== 'string' || !pk.startsWith('0x') || pk.length !== 66) {
      throw new WalletError('INTERNAL', 'EVM private key must be 0x-prefixed 32-byte hex');
    }
    this._wallet = new Wallet(pk, this.provider);
  }

  async #addressAt(index) {
    const pk = await this.deps.getPrivateKey(index);
    return new Wallet(pk).address;
  }

  async listAccounts() {
    const address = await this.#addressAt(this._index);
    return [{ index: this._index, address }];
  }

  async useAccount(index) {
    this._index = index;
    this._wallet = null;
    await this.#ensureWallet();
  }

  async activeAccount() {
    const address = await this.#addressAt(this._index);
    return { index: this._index, address };
  }

  /* -------------------------------- Balances ------------------------------- */

  async getNativeBalance() {
    await this.#ensureWallet();
    const wei = await this.provider.getBalance(this._wallet.address);
    return {
      total: formatEther(wei),
      decimals: this.deps.decimals ?? 18,
      symbol: this.deps.symbol,
    };
  }

  async getTokenBalance(tokenAddress) {
    await this.#ensureWallet();
    const meta = await this.#resolveTokenMeta(tokenAddress, { allowLazy: true });
    const c = new ethers.Contract(meta.address, ERC20_IFACE.fragments, this.provider);
    const raw = await c.balanceOf(this._wallet.address);
    return { total: formatUnits(raw, meta.decimals), decimals: meta.decimals, symbol: meta.symbol };
  }

  /* --------------------------------- Guards -------------------------------- */

  #ensureCapabilities(intent) {
    if (!['nativeTransfer', 'tokenTransfer', 'contractCall'].includes(intent.kind)) {
      throw new WalletError('NOT_SUPPORTED', `Unsupported intent: ${intent.kind}`);
    }
  }

  #computePlatformFeeRawBN(intent, amountRawBN, sendDecimals) {
    const pf = intent.platformFee || null;
    if (!pf?.receiver) return ZERO;

    let fee = ZERO;
    if (pf.percent != null && amountRawBN > ZERO) {
      fee += percentOf(amountRawBN, pf.percent); // bigint
    }
    if (pf.fixed != null) {
      fee += unitToWei(pf.fixed, sendDecimals);
    }
    return fee;
  }

  async #populateUnsignedTx(base, kindHint = 'nativeTransfer') {
    const net = await this.provider.getNetwork();
    const chainIdNum = this.deps.chainIdNumber ?? Number(net.chainId);

    const MIN_NATIVE_GAS = BigInt(21_000);
    const TOKEN_BASELINE = BigInt(65_000);
    const CALL_BASELINE  = BigInt(100_000);

    let gasLimit;
    try {
      const est = await this.provider.estimateGas({ ...base, from: this._wallet.address });
      const estBN = BigInt(est);
      if (kindHint === 'nativeTransfer') {
        gasLimit = estBN < MIN_NATIVE_GAS ? MIN_NATIVE_GAS : estBN;
      } else {
        gasLimit = (estBN * BigInt(12)) / BigInt(10); // +20%
      }
    } catch {
      gasLimit =
        kindHint === 'nativeTransfer' ? MIN_NATIVE_GAS :
          kindHint === 'tokenTransfer'  ? TOKEN_BASELINE  :
            CALL_BASELINE;
    }

    const fd = await this.provider.getFeeData();
    const gasPrice             = fd.gasPrice             ?? ONE_GWEI * BigInt(15);
    const maxPriorityFeePerGas = fd.maxPriorityFeePerGas ?? ONE_GWEI * BigInt(2);
    const maxFeePerGas         = fd.maxFeePerGas         ?? (gasPrice * BigInt(12)) / BigInt(10);

    const populated = await this._wallet.populateTransaction({
      ...base,
      chainId: chainIdNum,
      type: 2,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    const { from: _omit, ...unsigned } = populated;
    return unsigned;
  }

  #maybeApplyPlatformFee(intent, sendDecimals) {
    const pf = intent?.platformFee;
    const subtract =
      pf?.mode === 'subtract' ||
      intent?.applyPlatformFeeByReducingAmount === true;
    if (!subtract || !pf?.receiver) return intent;

    const amountBase =
      intent.kind === 'nativeTransfer'
        ? parseEther(String(intent.amount ?? 0))
        : parseUnits(String(intent.amount ?? 0), sendDecimals);

    let feeBase = ZERO;
    if (pf.percent != null) feeBase += percentOf(amountBase, pf.percent);
    if (pf.fixed != null)   feeBase += parseUnits(String(pf.fixed), sendDecimals);
    if (feeBase <= ZERO)    return intent;

    const net = amountBase > feeBase ? amountBase - feeBase : ZERO;
    const newAmount =
      intent.kind === 'nativeTransfer'
        ? Number(formatEther(net))
        : Number(formatUnits(net, sendDecimals));

    return { ...intent, amount: newAmount };
  }

  /* ----------------------- estimate / build / sign / send ------------------- */

  async estimate(intent) {
    await this.#ensureWallet();
    this.#ensureCapabilities(intent);

    const nativeSymbol   = this.deps.symbol;
    const nativeDecimals = this.deps.decimals ?? 18;

    // Resolve send-asset context
    let sendSymbol = nativeSymbol;
    let sendDecimals = nativeDecimals;

    if (intent.kind === 'tokenTransfer') {
      const meta = await this.#resolveTokenMeta(intent.tokenAddress, { allowLazy: true });
      sendDecimals = meta.decimals;
      sendSymbol   = meta.symbol;
    }

    // Amount in base units of the SEND asset
    const amountRawBN =
      intent.kind === 'nativeTransfer' ? etherToWei(intent.amount ?? 0) :
        intent.kind === 'tokenTransfer'  ? unitToWei(intent.amount ?? 0, sendDecimals) :
          intent.kind === 'contractCall'   ? BigInt(intent.value ?? 0) : ZERO;

    // tx for estimation
    const txReq = await this.#toTxReq(intent, sendDecimals);

    // gas estimate (fallbacks)
    let gasLimitBN;
    try {
      gasLimitBN = BigInt(await this.provider.estimateGas({ ...txReq, from: this._wallet.address }));
    } catch (err) {
      if (intent.kind === 'nativeTransfer') gasLimitBN = BigInt(21_000);
      else if (intent.kind === 'tokenTransfer') gasLimitBN = BigInt(65_000);
      else throw new WalletError('GAS_ESTIMATE_FAILED', err?.reason || err?.message || 'estimateGas failed');
    }

    // fees
    const fd = await this.provider.getFeeData();
    const is1559 = !!fd.maxFeePerGas || !!fd.maxPriorityFeePerGas;
    const maxFeePerGasBN         = BigInt(fd.maxFeePerGas ?? fd.gasPrice ?? ZERO);
    const maxPriorityFeePerGasBN = BigInt(fd.maxPriorityFeePerGas ?? ZERO);

    const feeWeiBN        = maxFeePerGasBN * gasLimitBN;
    const networkFeeHuman = weiToEth(feeWeiBN); // fee always in native

    // platform fee (send-asset units)
    const platformFeeRawBN = this.#computePlatformFeeRawBN(intent, amountRawBN, sendDecimals);
    const willReduceAmount = intent.platformFee?.mode === 'subtract'
      || intent.applyPlatformFeeByReducingAmount === true;

    const totalAmountSendBN = amountRawBN;
    const actualReceiveBN   = willReduceAmount
      ? (amountRawBN > platformFeeRawBN ? amountRawBN - platformFeeRawBN : ZERO)
      : amountRawBN;

    const details = {
      chainId: this.deps.chainId,
      kind: intent.kind,

      // network fee (native)
      networkFeeRaw: feeWeiBN,
      networkFeeHuman,
      decimals: String(nativeDecimals),
      assetSymbol: nativeSymbol,

      // gas model
      gasModel: is1559 ? 'eip1559' : 'legacy',
      gasLimit: gasLimitBN,
      maxFeePerGas: maxFeePerGasBN,
      maxPriorityFeePerGas: maxPriorityFeePerGasBN,
      baseFeePerGas: fd.lastBaseFeePerGas ?? null,
      suggestedGasPrice: fd.gasPrice ?? null,

      // token context (if any) — purely informational
      token: intent.kind === 'tokenTransfer'
        ? {
          address:  String(intent.tokenAddress),
          symbol:   sendSymbol,
          decimals: String(sendDecimals),
        }
        : null,

      // platform fee in SEND-asset units
      platformFeeRaw: platformFeeRawBN,
      platformFeeHuman: weiToUnit(platformFeeRawBN, sendDecimals),
      willReduceAmount,

      // totals in SEND-asset (human)
      totalAmountSend: weiToUnit(totalAmountSendBN, sendDecimals),
      actualReceive:   weiToUnit(actualReceiveBN, sendDecimals),
    };

    return {
      chain: this.deps.chainId,
      currency: sendSymbol,
      amount: weiToUnit(amountRawBN, sendDecimals),
      fee: networkFeeHuman,
      feeUnit: nativeSymbol,
      details,
    };
  }

  async build(intent) {
    await this.#ensureWallet();
    this.#ensureCapabilities(intent);

    // Resolve send-asset context
    const nativeDecimals = this.deps.decimals ?? 18;
    let sendDecimals = nativeDecimals;

    if (intent.kind === 'tokenTransfer') {
      const meta = await this.#resolveTokenMeta(intent.tokenAddress, { allowLazy: true });
      sendDecimals = meta.decimals;
    }

    // apply subtract mode upfront
    const adjusted = this.#maybeApplyPlatformFee(intent, sendDecimals);

    // amount base (for optional separate platform fee tx)
    const amountRaw =
      adjusted.kind === 'nativeTransfer'
        ? etherToWei(adjusted.amount ?? 0)
        : adjusted.kind === 'tokenTransfer'
          ? unitToWei(adjusted.amount ?? 0, sendDecimals)
          : (adjusted.value != null ? BigInt(adjusted.value) : ZERO);

    // MAIN unsigned
    const baseMain = await this.#toTxReq(adjusted, sendDecimals);
    const kindHint =
      adjusted.kind === 'tokenTransfer' ? 'tokenTransfer' :
        adjusted.kind === 'contractCall'  ? 'contractCall'  : 'nativeTransfer';

    const mainUnsigned = await this.#populateUnsignedTx(baseMain, kindHint);

    // Platform fee second tx if needed
    const pf = adjusted.platformFee;
    const willSubtract = pf?.mode === 'subtract' || adjusted.applyPlatformFeeByReducingAmount === true;
    const feeRaw = this.#computePlatformFeeRawBN(adjusted, amountRaw, sendDecimals);
    const needSeparateFeeTx = pf?.receiver && feeRaw > ZERO && !willSubtract;

    if (!needSeparateFeeTx) {
      return mainUnsigned;
    }

    // build fee tx
    const feeTo = pf.receiver;
    const isToken = adjusted.kind === 'tokenTransfer'; // sending token implies fee is also in token units
    const feeReq = isToken
      ? {
        to: String(adjusted.token),
        data: ERC20_IFACE.encodeFunctionData('transfer', [feeTo, feeRaw]),
        value: ZERO,
      }
      : { to: feeTo, value: feeRaw };

    let feeUnsigned = await this.#populateUnsignedTx(
      feeReq,
      isToken ? 'tokenTransfer' : 'nativeTransfer'
    );

    // bump nonce if we already have it on main tx
    if (mainUnsigned.nonce != null) {
      feeUnsigned = { ...feeUnsigned, nonce: Number(mainUnsigned.nonce) + 1 };
    }

    return [mainUnsigned, feeUnsigned];
  }

  async sign(unsignedTxOrArray) {
    await this.#ensureWallet();

    // Resolve chainId once for safety if missing in tx
    const net = await this.provider.getNetwork();
    const chainIdNum = this.deps.chainIdNumber ?? Number(net.chainId);

    const normalizeForTxFrom = (u) => {
      const txLike = (u && typeof u === 'object' && !('length' in u)) ? u : Transaction.from(u);
      const { from: _ignoreFrom, ...noFrom } = txLike;

      const t = { ...noFrom };
      if (t.gasLimit != null)             t.gasLimit = BigInt(t.gasLimit);
      if (t.maxFeePerGas != null)         t.maxFeePerGas = BigInt(t.maxFeePerGas);
      if (t.maxPriorityFeePerGas != null) t.maxPriorityFeePerGas = BigInt(t.maxPriorityFeePerGas);
      if (t.gasPrice != null)             t.gasPrice = BigInt(t.gasPrice);
      if (t.value != null)                t.value = BigInt(t.value);
      if (t.type != null)                 t.type = Number(t.type);
      if (t.chainId != null)              t.chainId = Number(t.chainId);
      if (t.nonce != null)                t.nonce = Number(t.nonce);

      if (!t.chainId || t.chainId === 0) {
        t.chainId = chainIdNum;
      }
      return t;
    };

    const signOne = async (u) => {
      const normalized = normalizeForTxFrom(u);
      const unsigned   = Transaction.from(normalized);
      const raw        = await this._wallet.signTransaction(unsigned);
      return { kind: 'tx', raw };
    };

    if (Array.isArray(unsignedTxOrArray)) {
      const out = [];
      for (const u of unsignedTxOrArray) out.push(await signOne(u));
      return out;
    }
    return await signOne(unsignedTxOrArray);
  }

  async send(signedOrArray) {
    const sendOne = async (signed) => {
      if (!signed || signed.kind !== 'tx') {
        throw new WalletError('NOT_SUPPORTED', 'send expects { kind:"tx", raw }');
      }
      const raw = signed.raw;

      if (this.provider?.broadcastTransaction) {
        const resp = await this.provider.broadcastTransaction(raw);
        return resp.hash ?? resp;
      }
      if (this.provider?.send) {
        return await this.provider.send('eth_sendRawTransaction', [raw]);
      }
      if (this._wallet?.provider?.send) {
        return await this._wallet.provider.send('eth_sendRawTransaction', [raw]);
      }
      throw new WalletError('INTERNAL', 'No way to broadcast transaction on current provider');
    };

    if (Array.isArray(signedOrArray)) {
      const hashes = [];
      for (const s of signedOrArray) hashes.push(await sendOne(s));
      return hashes; // [mainHash, feeHash]
    }
    return await sendOne(signedOrArray);
  }

  async signMessage(message) {
    if (this.deps.token) {
      throw new WalletError('NOT_SUPPORTED', 'Token wallet does not support message signing');
    }
    await this.#ensureWallet();
    const sig = await this._wallet.signMessage(message);
    return { kind: 'message', signature: sig };
  }

  // no-op event wiring placeholder
  on() { return () => {}; }

  /* --------------------------- tx request builder --------------------------- */

  async #toTxReq(intent, tokenDecimalsIfAny = 18) {
    if (intent.kind === 'nativeTransfer') {
      return { to: intent.to, value: etherToWei(intent.amount) };
    }
    if (intent.kind === 'tokenTransfer') {
      if (!intent.tokenAddress) throw new WalletError('INVALID_INTENT', 'tokenTransfer requires intent.tokenAddress');
      const decs = tokenDecimalsIfAny ?? 18;
      const amt  = unitToWei(intent.amount, decs);
      const data = ERC20_IFACE.encodeFunctionData('transfer', [intent.to, amt]);
      return { to: String(intent.tokenAddress), data, value: ZERO };
    }
    if (intent.kind === 'contractCall') {
      return {
        to: intent.to,
        data: intent.data,
        value: intent.value ? BigInt(intent.value) : ZERO,
      };
    }
    throw new WalletError('NOT_SUPPORTED', `Unsupported EVM intent: ${intent.kind}`);
  }
  /**
   * Get recent transaction history for this wallet or a token
   * via Moralis API v2.2
   *
   * @param {object} params
   * @param {String} [params.address] - wallet address (default: this._wallet.address)
   * @param {string} [params.tokenAddress] - optional ERC-20 token address
   * @param {string} [params.chain] - chain id or alias (default: this.deps.chainId)
   * @param {number} [params.limit] - max records (default 20)
   * @returns {Promise<Array>} normalized tx list
   */
  async getTransactionHistory({address = this._wallet.address,tokenAddress = null, chain = this.deps.chainId, limit = 20 }) {
    const client = this.deps.txHistoryProvider;
    if (!client) throw new WalletError('MISSING_CLIENT', 'Moralis client not configured');
    if (!address || !address.startsWith('0x')) throw new WalletError('INVALID_ADDRESS', 'Invalid wallet address');

    try {
      let endpoint = '';
      let params = { chain, limit, order: 'DESC' };
      if (tokenAddress && tokenAddress.startsWith('0x')) {
        // ERC-20 token transfers
        endpoint = `/${address}/erc20/transfers`;
        params.contract_addresses = tokenAddress;
      } else {
        // Native coin txs
        endpoint = `/wallets/${address}/history`;
      }

      const { data } = await client.get(endpoint, { params });
      const list = data.result || data; // Moralis returns `result` array in some endpoints

      return list.map(tx => {
        // Normalize common fields
        const isToken = !!tx.address || !!tx.token_symbol || !!tx.contract_type;
        const symbol = isToken
          ? tx.token_symbol || 'TOKEN'
          : this.deps.symbol || 'ETH';

        const valueRaw = tx.value || tx.value_decimal || tx.value_formatted || '0';
        const valueHuman = isToken
          ? formatUnits(valueRaw, parseInt(tx.token_decimals, 10) ?? 18)
          : formatEther(valueRaw);

        return {
          hash: tx.transaction_hash || tx.hash,
          from: tx.from_address,
          to: tx.to_address,
          valueRaw,
          value: valueHuman,
          symbol,
          category: isToken ? 'token' : 'native',
          blockNumber: tx.block_number,
          timestamp: tx.block_timestamp,
          direction: address.toLowerCase() === (tx.to_address || '').toLowerCase()
            ? 'in'
            : 'out',
          explorerUrl: this.deps?.explorerBaseUrl
            ? `${this.deps.explorerBaseUrl.replace(/\/+$/, '')}/${tx.transaction_hash || tx.hash}`
            : null,
        };
      });
    } catch (e) {
      logService.error('getTransactionHistory failed', e?.message || e);
      throw new WalletError('MORALIS_FETCH_FAILED', e?.message || 'Failed to fetch transaction history');
    }
  }
}
