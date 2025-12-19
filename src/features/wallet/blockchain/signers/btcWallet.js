// src/features/wallet/api/btcWallet.js
import * as btc from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';

import { BaseWallet } from '@src/features/wallet/blockchain/signers/baseWallet';
import { WalletError } from '@src/features/wallet/blockchain/type/types';

import { btcToSatsBN, satsToBtc, ZERO } from '@src/shared/lib/math/btcMath';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';
import logService from '@src/shared/infra/log/logService';

btc.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// ---- policy knobs (BN.js) ----
const MIN_RELAY_SAT_VB = BigInt(2);   // safer than 1 on public relays
const VBYTES_SAFETY    = BigInt(12);
const DUST_VBYTES      = BigInt(31);  // P2WPKH output vbytes approx
const DUST_MULTIPLIER  = BigInt(3);


// Dust threshold in satoshis, given feeRateBN (sats/vbyte)
function dustThresholdSats(feeRateBN) {
  // Each output ≈ DUST_VBYTES vbytes
  // Multiply by fee rate and safety multiplier
  return DUST_VBYTES * feeRateBN * DUST_MULTIPLIER;
}

// Approximate virtual size (vbytes)
// iBN = #inputs, oBN = #outputs
function approxVBytesBN(iBN, oBN) {
  return (iBN * BigInt(68)) + (oBN * BigInt(31)) + BigInt(10) + VBYTES_SAFETY;
}

// Fee in sats = vbytes * sats/vbyte
function feeForBN(iBN, oBN, feeRateBN) {
  return approxVBytesBN(iBN, oBN) * feeRateBN;
}
// Convert BTC (string/number) to sats (BN)
function toSats(amount) {
  return btcToSatsBN(amount);
}

export default class BtcWallet extends BaseWallet {
  constructor(deps) {
    super();
    this.deps = deps;
    this.index = 0;
    this.net = deps.network === 'testnet' ? btc.networks.testnet : btc.networks.bitcoin;
    // post-sign fee diagnostics
    this._lastBuildTotals = null; // { totalIn: BN, plannedOut: BN }
  }

  info() {
    return {
      chainId : this.deps.chainId,
      kind: CHAIN_ID_TO_FAMILY[this.deps.chainId],
      label : this.deps.label,
      symbol: this.deps.symbol,
      decimals:  this.deps.decimals,
      explorerBaseUrl: this.deps.explorerBaseUrl,
      explorerAddressBaseUrl: this.deps.explorerAddressBase,
      networklogServiceoUrl: this.deps.networklogServiceoUrl,
    };
  }

  capabilities() {
    return {
      nativeTransfer: true,
      tokenTransfer: false,
      contractCall: false,
      psbt: true,
      messageSign: [],
    };
  }

  // ---- accounts ----
  async _getNode(i) {
    const node = await this.deps.getNode(i);
    if (!node || !node.privateKey) {
      throw new WalletError('INTERNAL', 'Invalid BIP32 node from getNode');
    }
    return node;
  }

  async _getAddress(i) {
    const node = await this._getNode(i);
    if (!node.privateKey) throw new WalletError('INTERNAL', 'Node missing privateKey');

    const keyPair = ECPair.fromPrivateKey(
      // eslint-disable-next-line no-undef
      Buffer.isBuffer(node.privateKey) ? node.privateKey : Buffer.from(node.privateKey),
    );
    // eslint-disable-next-line no-undef
    const pubkey   = Buffer.from(keyPair.publicKey); // 33 bytes compressed
    const payment  = btc.payments.p2wpkh({ pubkey, network: this.net });

    if (!payment.address) throw new WalletError('INTERNAL', 'Failed to derive P2WPKH address');
    return payment.address;
  }

  async listAccounts() {
    const address = await this._getAddress(this.index);
    return [{ index: this.index, address }];
  }

  async useAccount(i) {
    this.index = i;
  }

  async activeAccount() {
    const address = await this._getAddress(this.index);
    return { index: this.index, address };
  }

  // ---- balances ----
  async getNativeBalance() {
    const addr  = await this._getAddress(this.index);
    logService.debug('Fetching native BTC balance', { index: this.index, address: addr });

    const utxos = (await this.deps.utxoProvider(addr)) || [];
    logService.debug('UTXOs fetched', { count: utxos.length, utxos });

    // Sum with BN
    const satsBN = utxos.reduce((a, u) => a + BigInt(u.value ?? 0), ZERO);
    logService.debug('Balance calculation', { sats: satsBN.toString() });

    const totalBTC = satsToBtc(satsBN);
    logService.debug('Balance result', {
      address: addr,
      sats: satsBN.toString(),
      btc: totalBTC,
    });

    return {
      total: totalBTC,
      decimals: 8,
      symbol: 'BTC',
    };
  }

  async getTokenBalance() {
    throw new WalletError('NOT_SUPPORTED', 'BTC has no token balances');
  }

  // ---- estimation ----
  async estimate(intent) {
    if (intent.kind !== 'nativeTransfer') {
      throw new WalletError('NOT_SUPPORTED', 'Only native transfers supported');
    }

    // 1) Fee rate (sats/vB), clamped to relay minimum
    let feeRate = BigInt(await this.deps.feeRateProvider());
    if (feeRate < (MIN_RELAY_SAT_VB)) feeRate = MIN_RELAY_SAT_VB;

    // 2) Platform fee (if provided)
    let platformFeeSats = ZERO;
    let feeOutputWillExist = false;

    if (intent.platformFee && intent.platformFee.receiver) {
      const pf = intent.platformFee;
      if (pf.percent != null) {
        const pct = Number(pf.percent); // e.g. 0.2 => 0.2%
        const sendValueBN = toSats(intent.amount); // sats
        const raw = Math.floor(Number(sendValueBN) * (pct / 100));
        platformFeeSats = platformFeeSats + BigInt(raw);
      }
      if (pf.fixed != null) {
        platformFeeSats = platformFeeSats + toSats(pf.fixed);
      }
    }

    // 3) Dust limits / minimums at this feerate
    const dustThreshold = dustThresholdSats(feeRate);
    const minSendSats   = dustThreshold;
    if (platformFeeSats >= dustThreshold) feeOutputWillExist = true;

    // 4) Size assumption
    const inputsAssumed  = BigInt(1);
    const outputsAssumed = BigInt(2) + (feeOutputWillExist ? BigInt(1) : ZERO);
    const vbytes         = approxVBytesBN(inputsAssumed, outputsAssumed);

    // 5) Estimated miner fee in sats
    const fee = vbytes * (feeRate);

    // 6) Format unified result
    const feeHuman        = (Number(fee) / 1e8).toString(); // BTC
    const platformFeeHuman = platformFeeSats > (ZERO)
      ? (Number(platformFeeSats) / 1e8).toString()
      : '0';

    return {
      fee: feeHuman,       // human-friendly fee in BTC
      feeUnit: 'BTC',    // always BTC for Bitcoin
      details: {
        chainId: this.info().chainId,   // btc | btc-testnet | btc-signet
        kind: intent.kind,              // nativeTransfer
        feeRaw: fee,       // raw sats
        decimals: '8',
        assetSymbol: 'BTC',

        // BTC-specific
        feeRateSatsVb: feeRate,
        approxVBytes: vbytes,
        inputsAssumed: inputsAssumed,
        outputsAssumed: outputsAssumed,

        // policy
        minRelayFeeRateSatsVb: MIN_RELAY_SAT_VB,
        dustThresholdSats: dustThreshold,
        minSendSats: minSendSats,

        // platform fee
        platformFeeRaw: platformFeeSats, // sats
        platformFeeHuman,                             // BTC
        willReduceAmount: false, // in Bitcoin we don’t subtract from amount directly
      },
    };
  }

  // ---- build (greedy coin selection, P2WPKH, RBF) ----
  async build(intent) {
    if (intent.kind !== 'nativeTransfer') {
      throw new WalletError('NOT_SUPPORTED', 'Only native transfers supported');
    }

    const toAddress = intent.to;
    const sendValue = toSats(intent.amount); // BN
    logService.info('start build', { to: toAddress, sats: sendValue });

    // derive sender
    const fromNode = await this._getNode(this.index);
    const keyPair  = ECPair.fromPrivateKey(
      // eslint-disable-next-line no-undef
      Buffer.isBuffer(fromNode.privateKey) ? fromNode.privateKey : Buffer.from(fromNode.privateKey),
    );
    // eslint-disable-next-line no-undef
    const fromPubkey  = Buffer.from(keyPair.publicKey);
    const fromPayment = btc.payments.p2wpkh({ pubkey: fromPubkey, network: this.net });
    const fromAddress = fromPayment.address;
    if (!fromAddress) throw new WalletError('INTERNAL', 'Failed to derive fromAddress');
    logService.debug('from address', { fromAddress });

    // UTXOs
    const utxos = (await this.deps.utxoProvider(fromAddress)) || [];
    logService.debug('utxos fetched', { count: utxos.length });
    if (!utxos.length) throw new WalletError('INSUFFICIENT_FUNDS', 'No UTXOs');
    utxos.sort((a, b) => b.value - a.value);

    // feerate policy
    let feeRate = BigInt(await this.deps.feeRateProvider());
    if (feeRate < (MIN_RELAY_SAT_VB)) feeRate = MIN_RELAY_SAT_VB;
    logService.debug('feeRate', { feeRate: feeRate });

    // reject trivial amount (dust)
    const dustLimit = dustThresholdSats(feeRate);
    if (sendValue < (dustLimit)) {
      throw new WalletError('AMOUNT_TOO_SMALL', `Send below dust limit: ≥ ${dustLimit} sats`);
    }

    const psbt = new btc.Psbt({ network: this.net });
    let totalIn = ZERO;

    // select inputs until amount + fee is covered (assume 2 outputs: recipient+change)
    for (const u of utxos) {
      let nonWitnessUtxo;
      try {
        const rawHex = await this.deps.rawTxProvider(u.txid);
        // eslint-disable-next-line no-undef
        nonWitnessUtxo = Buffer.from(rawHex, 'hex');
      } catch {
        nonWitnessUtxo = undefined;
      }

      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        nonWitnessUtxo,
        sequence: 0xfffffffd,
        sighashType: btc.Transaction.SIGHASH_ALL,
      });

      totalIn = totalIn + BigInt(u.value);
      const inputsCountBN = BigInt(psbt.data.inputs.length);
      const need = sendValue + feeForBN(inputsCountBN, BigInt(2), feeRate);
      logService.debug('select loop', { totalIn: totalIn, needed: need });
      if (totalIn >= need) break;
    }

    const inputsCount = psbt.data.inputs.length;
    if (inputsCount === 0) throw new WalletError('INSUFFICIENT_FUNDS', 'Not enough UTXOs');

    // recipient
    try{
      psbt.addOutput({ address: toAddress, value: Number(sendValue)});
    }catch (e) {
      logService.warn('addOutput failed', { toAddress, err: e?.message });
    }

    // recompute with 2 outputs (recipient + change)
    const fee2   = feeForBN(BigInt(inputsCount), BigInt(2), feeRate);
    let changeBN = totalIn - sendValue - fee2;
    if (changeBN < ZERO) throw new WalletError('INSUFFICIENT_FUNDS', 'Insufficient funds');

    if (changeBN >= dustLimit) {
      psbt.addOutput({ address: fromAddress, value: Number(changeBN) });
      logService.debug('added change output', { change: changeBN });
    } else {
      // fold small change into fee (no change output)
      logService.debug('change folded into fee');
      changeBN = ZERO;
    }

    this._lastBuildTotals = { totalIn, plannedOut: sendValue + changeBN };
    logService.info('final build', { inputs: psbt.data.inputs.length, outputs: psbt.data.outputs.length });

    return psbt.toBuffer();
  }

  // ---- sign ----
  // Accepts either a Buffer (psbt bytes) or a bitcoin.Psbt instance.
  async sign(unsigned) {
    const psbt =
      unsigned instanceof btc.Psbt
        ? unsigned
        : btc.Psbt.fromBuffer(unsigned, { network: this.net });

    logService.debug('inputs', { count: psbt.data.inputs.length });

    const node = await this._getNode(this.index);
    // eslint-disable-next-line no-undef
    const priv = Buffer.isBuffer(node.privateKey) ? node.privateKey : Buffer.from(node.privateKey);
    const keyPair  = ECPair.fromPrivateKey(priv);
    // eslint-disable-next-line no-undef
    const pubkey   = Buffer.from(keyPair.publicKey);

    // Expected script (P2WPKH)
    btc.payments.p2wpkh({ pubkey, network: this.net });
    logService.debug('signer', { pubkey: pubkey.toString('hex') });

    const signer = {
      // eslint-disable-next-line no-undef
      sign: async (msghash) => Buffer.from(keyPair.sign(msghash)),
      // eslint-disable-next-line no-undef
      publicKey: Buffer.from(keyPair.publicKey),
    };

    let ok = 0;
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      try {
        await psbt.signInputAsync(i, signer, [btc.Transaction.SIGHASH_ALL]);
        logService.debug('signed input', { i });
        ok++;
      } catch (e) {
        logService.warn('sign input failed', { i, err: e?.message });
      }
    }

    if (ok === 0) {
      try {
        await psbt.signAllInputsAsync(signer);
        logService.info('fallback signAllInputsAsync used');
      } catch (e) {
        logService.error('bulk signing failed', { err: e?.message });
        throw e;
      }
    }

    try {
      psbt.finalizeAllInputs();
    } catch (e) {
      logService.error('finalizeAllInputs failed', { err: e?.message });
      for (let i = 0; i < psbt.data.inputs.length; i++) {
        try {
          psbt.finalizeInput(i);
        } catch (ie) {
          logService.error('finalizeInput failed', { i, err: ie?.message });
        }
      }
      psbt.finalizeAllInputs();
    }

    // Post-sign diagnostics
    const tx    = psbt.extractTransaction();
    const vsize = BigInt(tx.virtualSize());
    try {
      const totalOutBN = tx.outs.reduce((a, o) => a + BigInt(o.value), ZERO);
      if (this._lastBuildTotals) {
        const totalInBN = this._lastBuildTotals.totalIn;
        const feeBN     = totalInBN - totalOutBN;
        const feeRateBN = vsize > ZERO ? feeBN/vsize : null;
        logService.info('post-sign fee check', {
          vsize: vsize,
          fee: feeBN,
          feeRate: feeRateBN ? feeRateBN : 'n/a',
        });
      }
    } catch (e) {
      logService.warn('feerate diagnostic failed', { err: e?.message });
    }

    const rawHex = tx.toHex();
    logService.info('signed tx', { hexLen: rawHex.length });
    return { kind: 'tx', raw: rawHex };
  }

  // ---- send ----
  async send(signed) {
      logService.info('broadcast start');
    if (signed.kind !== 'tx') {
      throw new WalletError('NOT_SUPPORTED', 'send expects { kind:"tx", raw }');
    }
    const txid = await this.deps.broadcaster(signed.raw);
    logService.info('broadcast success', { txid });
    return txid;
  }

  // ---- messages ----
  async signMessage() {
    throw new WalletError('NOT_SUPPORTED', 'Message signing not implemented for BTC');
  }

  on() {
    return () => {};
  }

  async getTransactionHistory({ address, limit = 20, cursor } = {}) {
    const addr = address || (await this._getAddress(this.index));
    if (!this.deps?.txHistoryProvider) {
      throw new WalletError('NOT_SUPPORTED', 'No txHistoryProvider configured for BTC');
    }

    const firstAddr = (obj) => {
      if (!obj) return undefined;
      if (obj.address) return obj.address;
      if (obj.scriptpubkey_address) return obj.scriptpubkey_address;
      if (obj.prevout?.scriptpubkey_address) return obj.prevout.scriptpubkey_address;
      if (Array.isArray(obj.addresses) && obj.addresses.length) return obj.addresses[0];
      return undefined;
    };

    const valueOf = (obj) => {
      if (typeof obj?.value === 'number') return BigInt(obj.value);
      if (typeof obj?.value === 'string' && obj.value !== '') return BigInt(obj.value);
      if (obj?.prevout?.value) return BigInt(obj.prevout.value);
      return ZERO;
    };

    let page;
    try {
      page = await this.deps.txHistoryProvider(addr, { limit, cursor });
    } catch (e) {
      throw new WalletError('BTC_HISTORY_FETCH_FAILED', e?.message || 'Failed to fetch BTC history');
    }

    const rawList = Array.isArray(page)
      ? page
      : Array.isArray(page?.items)
        ? page.items
        : [];
    const nextCursor = page?.cursor;

    const items = rawList.map((tx) => {
      const hash = tx.hash || tx.txid || '';
      const feeSats =
        typeof tx.fee === 'number' || typeof tx.fee === 'string' ? BigInt(tx.fee) : undefined;

      const vins = Array.isArray(tx.vin)
        ? tx.vin
        : Array.isArray(tx.inputs)
          ? tx.inputs
          : [];
      const vouts = Array.isArray(tx.vout)
        ? tx.vout
        : Array.isArray(tx.outputs)
          ? tx.outputs
          : [];

      let sentFromMe = ZERO;
      for (const vin of vins) {
        const a = firstAddr(vin);
        if (a && a === addr) sentFromMe += valueOf(vin);
      }

      let receivedToMe = ZERO;
      for (const vout of vouts) {
        const a = firstAddr(vout);
        if (a && a === addr) receivedToMe += valueOf(vout);
      }

      const netSats = receivedToMe - sentFromMe;
      const direction = netSats >= ZERO ? 'in' : 'out';
      const absSats = netSats >= ZERO ? netSats : ZERO - netSats;
      const value = satsToBtc(absSats);

      let ts;
      if (typeof tx.time === 'number') ts = new Date(tx.time * 1000).toISOString();
      else if (typeof tx.blockTime === 'number') ts = new Date(tx.blockTime * 1000).toISOString();
      else if (tx?.status?.block_time != null)
        ts = new Date(Number(tx.status.block_time) * 1000).toISOString();
      else if (typeof tx.timestamp === 'string') ts = tx.timestamp;

      const explorerUrl = this.deps?.explorerBaseUrl
        ? `${this.deps.explorerBaseUrl.replace(/\/+$/, '')}/tx/${hash}`
        : undefined;
      const blockNumber =
        tx?.status?.block_height != null ? Number(tx.status.block_height) : null;

// crude best-effort "from" / "to" (first differing addr in vin/vout)
      const inputAddr  = vins.map(v => firstAddr(v)).find(Boolean);
      const outputAddr = vouts.map(v => firstAddr(v)).find(Boolean);

      return {
        hash,
        direction,
        value,
        valueRaw: absSats.toString(),
        symbol: 'BTC',
        timestamp: ts,
        explorerUrl,
        category: 'native',
        blockNumber,
        from: inputAddr,
        to: outputAddr,
        status: tx?.status?.confirmed === false ? 'pending' : (blockNumber ? 'success' : 'unknown'),
        feeRaw: feeSats?.toString(),
        fee: feeSats != null ? satsToBtc(feeSats) : undefined,
      };
    });

    return { items, cursor: nextCursor };
  }
}
