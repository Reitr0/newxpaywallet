// src/features/wallet/api/solWallet.js
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { BaseWallet } from '@src/features/wallet/blockchain/signers/baseWallet';
import { WalletError } from '@src/features/wallet/blockchain/type/types';
import { formatUnits, fromLamports, parseUnits, percentOf, toLamports, ZERO, } from '@src/shared/lib/math/solMath';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';

/* ------------------------------ helpers ------------------------------ */

function isOffCurve(pk) {
  try { return !PublicKey.isOnCurve(pk.toBytes()); } catch { return false; }
}

/** Detect which token program owns a mint (SPL vs Token-2022). */
async function detectTokenProgram(conn, mintPk) {
  const ai = await conn.getAccountInfo(mintPk, 'confirmed');
  if (!ai) throw new WalletError('INVALID_ARG', 'Mint account not found');
  const owner = ai.owner?.toBase58?.();
  if (owner === TOKEN_2022_PROGRAM_ID.toBase58()) return TOKEN_2022_PROGRAM_ID;
  if (owner === TOKEN_PROGRAM_ID.toBase58()) return TOKEN_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

/* ============================== SolWallet ==============================

deps = {
  rpcUrl: string,
  chainId: 'solana' | 'solana-devnet' | ...,
  label: string,
  explorerBaseUrl?: string,          // tx base (cluster suffix baked by factory)
  explorerAddressBaseUrl?: string,   // address base (cluster suffix baked by factory)
  networkLogoUrl?: string,
  getEd25519Seed: (index:number)=>Promise<Uint8Array>, // 32-byte seed
}

======================================================================= */

export default class SolWallet extends BaseWallet {
  constructor(deps) {
    super();
    this.deps = deps;
    this.conn = new Connection(deps.rpcUrl, 'confirmed');
    this._index = 0;
    this._kp = null; // Keypair

    /** mint(lowercased) -> { mint, symbol, decimals, name? } */
    this._tokens = new Map();
  }

  /* --------------------------- Token registry --------------------------- */

  async registerToken(meta) {
    const mint = String(meta.mint || meta.address || '').trim();
    if (!mint) throw new WalletError('INVALID_TOKEN', 'Missing token mint');
    const mintLc = mint.toLowerCase();
    let decimals = meta.decimals;

    // Optionally lazy fetch decimals if not provided
    if (decimals == null) {
      const mintPk = new PublicKey(mint);
      // using getTokenSupply only yields decimals reliably when mint exists
      const supply = await this.conn.getTokenSupply(mintPk);
      decimals = Number(supply?.value?.decimals ?? 9);
    }

    this._tokens.set(mintLc, {
      mint,
      symbol: meta.symbol || 'SPL',
      decimals: Number(decimals ?? 9),
      name: meta.name || '',
    });
  }

  unregisterToken(mintOrAddress) {
    const k = String(mintOrAddress || '').toLowerCase();
    this._tokens.delete(k);
  }

  listTokens() {
    return Array.from(this._tokens.values());
  }

  async #resolveTokenMeta(mintOrAddress, { allowLazy = true } = {}) {
    const key = String(mintOrAddress || '').toLowerCase();
    if (!key) throw new WalletError('INVALID_TOKEN', 'Invalid token mint');
    let meta = this._tokens.get(key);
    if (meta) return meta;

    if (!allowLazy) throw new WalletError('UNKNOWN_TOKEN', 'Token not registered');

    // Lazy: infer decimals via getTokenSupply (works for SPL + 2022)
    const mintPk = new PublicKey(mintOrAddress);
    const sup = await this.conn.getTokenSupply(mintPk);
    const decimals = Number(sup?.value?.decimals ?? 9);
    const out = { mint: mintOrAddress, symbol: 'SPL', decimals };
    // you can cache: this._tokens.set(key, out);
    return out;
  }

  /* --------------------------------- info --------------------------------- */

  info() {
    return {
      chainId: this.deps.chainId,
      kind: CHAIN_ID_TO_FAMILY[this.deps.chainId],
      label: this.deps.label,
      symbol: 'SOL',
      decimals: 9,
      explorerBaseUrl: this.deps.explorerBaseUrl,
      explorerAddressBaseUrl: this.deps.explorerAddressBaseUrl,
      networkLogoUrl: this.deps.networkLogoUrl,
    };
  }

  capabilities() {
    return {
      nativeTransfer: true,
      tokenTransfer: true,
      contractCall: true, // keep for future program interactions
      psbt: false,
      messageSign: ['solana'],
    };
  }

  /* ---------------------------- key material ---------------------------- */

  async #ensureKeypair() {
    if (this._kp) return;
    const seed32 = await this.deps.getEd25519Seed(this._index);
    if (!(seed32 instanceof Uint8Array) || seed32.length !== 32) {
      throw new WalletError('INTERNAL', 'Solana requires 32-byte ed25519 seed');
    }
    this._kp = Keypair.fromSeed(seed32);
  }

  async #addressAt(i) {
    const seed32 = await this.deps.getEd25519Seed(i);
    return Keypair.fromSeed(seed32).publicKey.toBase58();
  }

  /* ------------------------------- accounts ------------------------------ */

  async listAccounts() {
    const a = await this.#addressAt(this._index);
    return [{ index: this._index, address: a }];
  }

  async useAccount(i) {
    this._index = i;
    this._kp = null;
    await this.#ensureKeypair();
  }

  async activeAccount() {
    const a = await this.#addressAt(this._index);
    return { index: this._index, address: a };
  }

  /* ------------------------------- balances ------------------------------ */

  async getNativeBalance() {
    await this.#ensureKeypair();
    const lamports = await this.conn.getBalance(this._kp.publicKey);
    return { total: fromLamports(BigInt(lamports)), decimals: 9, symbol: 'SOL' };
  }

  async getTokenBalance(mint) {
    await this.#ensureKeypair();
    const ownerPk = this._kp.publicKey;
    const mintPk  = new PublicKey(mint);

    const tokenProgramId = await detectTokenProgram(this.conn, mintPk);

    const ata = await getAssociatedTokenAddress(
      mintPk, ownerPk, isOffCurve(ownerPk), tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Try canonical ATA
    try {
      const bal = await this.conn.getTokenAccountBalance(ata);
      return {
        total: bal.value?.uiAmountString ?? '0',
        decimals: bal.value?.decimals ?? 0,
        symbol: 'SPL',
      };
    } catch { /* ATA missing -> fallback */ }

    // Fallback: sum all token accounts for this mint
    try {
      const parsed = await this.conn.getParsedTokenAccountsByOwner(ownerPk, { mint: mintPk });
      let rawSum = ZERO;
      let decimals = 0;
      for (const { account } of parsed.value || []) {
        const info = account?.data?.parsed?.info;
        const amtStr = info?.tokenAmount?.amount ?? '0';
        const dec = Number(info?.tokenAmount?.decimals ?? 0);
        decimals = Math.max(decimals, dec);
        try { rawSum += BigInt(amtStr); } catch {}
      }
      if (rawSum === ZERO) return { total: '0', decimals: 0, symbol: 'SPL' };

      const total = (() => {
        if (decimals === 0) return rawSum.toString();
        const base = BigInt(10) ** BigInt(decimals);
        const i = (rawSum / base).toString(10);
        const r = (rawSum % base).toString(10).padStart(decimals, '0').replace(/0+$/, '');
        return r ? `${i}.${r}` : i;
      })();

      return { total, decimals, symbol: 'SPL' };
    } catch {
      return { total: '0', decimals: 0, symbol: 'SPL' };
    }
  }

  /* ------------------------------- estimate ------------------------------- */

  async estimate(intent) {
    await this.#ensureKeypair();
    const payer = this._kp.publicKey;

    const isToken = intent.kind === 'tokenTransfer';

    // Resolve token meta if needed
    let sendSymbol = 'SOL';
    let sendDecimals = 9;
    let mintPk = null;

    if (isToken) {
      const meta = await this.#resolveTokenMeta(intent.tokenAddress ?? intent.token, { allowLazy: true });
      sendSymbol = meta.symbol || 'SPL';
      sendDecimals = Number(meta.decimals ?? 9);
      mintPk = new PublicKey(meta.mint);
    }

    // Base amounts
    const amountBase = isToken
      ? parseUnits(intent.amount ?? 0, sendDecimals)
      : toLamports(intent.amount ?? 0);

    // Platform fee (in SEND-ASSET units)
    const pf = intent.platformFee || null;
    let platformFeeBase = ZERO;
    if (pf?.receiver) {
      if (pf.percent != null && amountBase > ZERO) {
        platformFeeBase += percentOf(amountBase, pf.percent);
      }
      if (pf.fixed != null) {
        platformFeeBase += isToken
          ? parseUnits(pf.fixed, sendDecimals)
          : toLamports(pf.fixed);
      }
    }
    const willReduceAmount =
      pf?.mode === 'subtract' || intent.applyPlatformFeeByReducingAmount === true;

    // Build a dummy message to estimate fees & ATA rent creation
    const { feeLamports, ataRentLamportsTotal } =
      await this.#estimateNetworkAndRent(
        payer, intent, amountBase, platformFeeBase, willReduceAmount, sendDecimals, mintPk
      );

    const details = {
      chainId: this.deps.chainId,
      kind: intent.kind,
      networkFeeRaw: feeLamports.toString(),
      networkFeeHuman: fromLamports(feeLamports),
      assetSymbol: 'SOL',
      decimals: '9',
      token: isToken ? {
        address: String(mintPk),
        symbol: sendSymbol,
        decimals: String(sendDecimals),
      } : null,
      platformFeeRaw: platformFeeBase.toString(),
      platformFeeHuman: isToken
        ? formatUnits(platformFeeBase, sendDecimals)
        : fromLamports(platformFeeBase),
      willReduceAmount,
      totalAmountSend: isToken
        ? formatUnits(amountBase, sendDecimals)
        : fromLamports(amountBase),
      actualReceive: isToken
        ? formatUnits(
          willReduceAmount
            ? (amountBase > platformFeeBase ? amountBase - platformFeeBase : ZERO)
            : amountBase,
          sendDecimals
        )
        : fromLamports(
          willReduceAmount
            ? (amountBase > platformFeeBase ? amountBase - platformFeeBase : ZERO)
            : amountBase
        ),
      ataCreationLamports: ataRentLamportsTotal.toString(),
      ataCreationHuman: fromLamports(ataRentLamportsTotal),
    };

    return {
      chain: this.deps.chainId,
      currency: sendSymbol,
      amount: isToken ? formatUnits(amountBase, sendDecimals) : fromLamports(amountBase),
      fee: fromLamports(feeLamports),
      feeUnit: 'SOL',
      details,
    };
  }

  async #estimateNetworkAndRent(
    payer,
    intent,
    amountBase,
    platformFeeBase,
    willReduceAmount,
    tokenDecimals,
    preResolvedMintPk // may be null for native
  ) {
    const { blockhash } = await this.conn.getLatestBlockhash('finalized');

    const ixns = [];
    let ataRentLamportsTotal = ZERO; // (optional) compute rent via getMinimumBalanceForRentExemption for token acc

    if (intent.kind === 'nativeTransfer') {
      ixns.push(SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: new PublicKey(intent.to),
        lamports: amountBase,
      }));
      if (platformFeeBase > ZERO && !willReduceAmount && intent.platformFee?.receiver) {
        ixns.push(SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(intent.platformFee.receiver),
          lamports: platformFeeBase,
        }));
      }
    } else if (intent.kind === 'tokenTransfer') {
      const mint = preResolvedMintPk ?? new PublicKey(intent.tokenAddress ?? intent.token);
      const toWallet = new PublicKey(intent.to);

      const tokenProgramId = await detectTokenProgram(this.conn, mint);

      const meAllowOffCurve = isOffCurve(payer);
      const toAllowOffCurve = isOffCurve(toWallet);

      const fromAta = await getAssociatedTokenAddress(
        mint, payer, meAllowOffCurve, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const toAta = await getAssociatedTokenAddress(
        mint, toWallet, toAllowOffCurve, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const toInfo = await this.conn.getAccountInfo(toAta);
      if (!toInfo) {
        if (toAllowOffCurve) {
          // ATA creation for PDAs is not allowed by the associated token program
          // (owner must create it via the program)
          // We still estimate the main tx and surface this constraint in build()
        } else {
          ixns.push(
            createAssociatedTokenAccountInstruction(
              payer, toAta, toWallet, mint, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
          // (Optional) you can add rent computation here if desired
        }
      }

      const mainAmount = willReduceAmount
        ? (amountBase > platformFeeBase ? amountBase - platformFeeBase : ZERO)
        : amountBase;

      if (mainAmount > ZERO) {
        ixns.push(
          createTransferCheckedInstruction(
            fromAta, mint, toAta, payer,
            BigInt(mainAmount),
            Number(tokenDecimals),
            [],
            tokenProgramId
          )
        );
      }

      if (platformFeeBase > ZERO && !willReduceAmount && intent.platformFee?.receiver) {
        const pfReceiver = new PublicKey(intent.platformFee.receiver);
        const pfAllowOffCurve = isOffCurve(pfReceiver);

        const feeToAta = await getAssociatedTokenAddress(
          mint, pfReceiver, pfAllowOffCurve, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const feeToInfo = await this.conn.getAccountInfo(feeToAta);
        if (!feeToInfo) {
          if (!pfAllowOffCurve) {
            ixns.push(
              createAssociatedTokenAccountInstruction(
                payer, feeToAta, pfReceiver, mint, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
              )
            );
          }
        }
        ixns.push(
          createTransferCheckedInstruction(
            fromAta, mint, feeToAta, payer,
            BigInt(platformFeeBase),
            Number(tokenDecimals),
            [],
            tokenProgramId
          )
        );
      }
    } else {
      throw new WalletError('NOT_SUPPORTED', `estimate unsupported for ${intent.kind}`);
    }

    const msg = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: ixns,
    }).compileToV0Message();

    const feeForMsg = await this.conn.getFeeForMessage(msg, 'confirmed');
    const feeLamports = BigInt(feeForMsg?.value ?? 5000);
    return { feeLamports, ataRentLamportsTotal };
  }

  /* ---------------------------------- build --------------------------------- */

  async build(intent) {
    await this.#ensureKeypair();

    const payer = this._kp.publicKey;
    const { blockhash } = await this.conn.getLatestBlockhash('finalized');

    const isToken = intent.kind === 'tokenTransfer';
    let sendDecimals = 9;
    let mintPk = null;

    if (isToken) {
      const meta = await this.#resolveTokenMeta(intent.tokenAddress ?? intent.token, { allowLazy: true });
      sendDecimals = Number(meta.decimals ?? 9);
      mintPk = new PublicKey(meta.mint);
    }

    const amountBase = isToken
      ? parseUnits(intent.amount ?? 0, sendDecimals)
      : toLamports(intent.amount ?? 0);

    const pf = intent.platformFee || null;
    let platformFeeBase = ZERO;
    if (pf?.receiver) {
      if (pf.percent != null && amountBase > ZERO) {
        platformFeeBase += percentOf(amountBase, pf.percent);
      }
      if (pf.fixed != null) {
        platformFeeBase += isToken
          ? parseUnits(pf.fixed, sendDecimals)
          : toLamports(pf.fixed);
      }
    }
    const willReduceAmount =
      pf?.mode === 'subtract' || intent.applyPlatformFeeByReducingAmount === true;

    const ixns = [];

    if (intent.kind === 'nativeTransfer') {
      const mainLamports = willReduceAmount
        ? (amountBase > platformFeeBase ? amountBase - platformFeeBase : ZERO)
        : amountBase;

      if (mainLamports > ZERO) {
        ixns.push(SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(intent.to),
          lamports: BigInt(mainLamports),
        }));
      }

      if (platformFeeBase > ZERO && !willReduceAmount && pf?.receiver) {
        ixns.push(SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(pf.receiver),
          lamports: BigInt(platformFeeBase),
        }));
      }
    } else if (intent.kind === 'tokenTransfer') {
      const mint = mintPk ?? new PublicKey(intent.tokenAddress ?? intent.token);
      const toWallet = new PublicKey(intent.to);

      const tokenProgramId = await detectTokenProgram(this.conn, mint);

      const meAllowOffCurve = isOffCurve(payer);
      const toAllowOffCurve = isOffCurve(toWallet);

      const fromAta = await getAssociatedTokenAddress(
        mint, payer, meAllowOffCurve, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const toAta = await getAssociatedTokenAddress(
        mint, toWallet, toAllowOffCurve, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Ensure recipient ATA; reject if recipient is PDA (program must create)
      const toInfo = await this.conn.getAccountInfo(toAta);
      if (!toInfo) {
        if (toAllowOffCurve) {
          throw new WalletError(
            'INVALID_ARG',
            'Recipient is a PDA/off-curve without an ATA. Ask the program/owner to create the ATA first.'
          );
        }
        ixns.push(
          createAssociatedTokenAccountInstruction(
            payer, toAta, toWallet, mint, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      const mainAmount = willReduceAmount
        ? (amountBase > platformFeeBase ? amountBase - platformFeeBase : ZERO)
        : amountBase;

      if (mainAmount > ZERO) {
        ixns.push(
          createTransferCheckedInstruction(
            fromAta, mint, toAta, payer,
            BigInt(mainAmount),
            Number(sendDecimals),
            [],
            tokenProgramId
          )
        );
      }

      if (platformFeeBase > ZERO && !willReduceAmount && pf?.receiver) {
        const pfReceiverPk = new PublicKey(pf.receiver);
        const pfAllowOffCurve = isOffCurve(pfReceiverPk);

        const feeToAta = await getAssociatedTokenAddress(
          mint, pfReceiverPk, pfAllowOffCurve, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const feeToInfo = await this.conn.getAccountInfo(feeToAta);
        if (!feeToInfo) {
          if (pfAllowOffCurve) {
            throw new WalletError(
              'INVALID_ARG',
              'Platform fee receiver is a PDA/off-curve without ATA. Use on-curve or pre-create the ATA.'
            );
          }
          ixns.push(
            createAssociatedTokenAccountInstruction(
              payer, feeToAta, pfReceiverPk, mint, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        ixns.push(
          createTransferCheckedInstruction(
            fromAta, mint, feeToAta, payer,
            BigInt(platformFeeBase),
            Number(sendDecimals),
            [],
            tokenProgramId
          )
        );
      }
    } else {
      throw new WalletError('NOT_SUPPORTED', `Unsupported Solana intent: ${intent.kind}`);
    }

    const msg = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: ixns,
    }).compileToV0Message();

    const tx = new VersionedTransaction(msg);
    return tx.serialize(); // unsigned bytes
  }

  /* ------------------------------ sign & send ------------------------------ */

  async sign(unsignedBytes) {
    await this.#ensureKeypair();
    const tx = VersionedTransaction.deserialize(unsignedBytes);
    tx.sign([this._kp]);
    return { kind: 'tx', raw: Buffer.from(tx.serialize()).toString('base64') };
  }

  async send(signed) {
    if (signed.kind !== 'tx') {
      throw new WalletError('NOT_SUPPORTED', 'send expects { kind:"tx", raw }');
    }
    return await this.conn.sendRawTransaction(Buffer.from(signed.raw, 'base64'));
  }

  /* -------------------------------- messages ------------------------------- */

  async signMessage() {
    throw new WalletError('NOT_SUPPORTED', 'Add ed25519 message signing if needed');
  }

  on() { return () => {}; }

  /**
   * Get SOL/SPL transaction history for the active account.
   *
   * Args:
   *  - address?: string (defaults to active)
   *  - tokenAddress?: string (SPL mint). If present -> token transfers only
   *  - limit?: number (default 20)
   *  - cursor?: string (use as "before" signature for pagination)
   *
   * Returns:
   *  { items: Array<{
   *      hash, direction: 'in'|'out', value, symbol, timestamp, explorerUrl,
   *      blockNumber?, status?, from?, to?
   *    }>, cursor?: string }
   */
  async getTransactionHistory({ address, tokenAddress, limit = 20, cursor } = {}) {
    await this.#ensureKeypair();
    const ownerAddr = address || this._kp.publicKey.toBase58();
    const ownerPk = new PublicKey(ownerAddr);
    const before = cursor || undefined;
    const sigs = await this.conn.getSignaturesForAddress(ownerPk, { limit, before });
    if (!Array.isArray(sigs) || sigs.length === 0) return { items: [], cursor: undefined };

    const signatures = sigs.map((s) => s.signature);
    const parsed = await this.conn.getParsedTransactions(signatures, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    // Precompute token context if applicable
    let tokenMeta = null;
    let ownerAtaMain = null;
    let ownerAtaAlt = null;
    if (tokenAddress) {
      tokenMeta = await this.#resolveTokenMeta(tokenAddress, { allowLazy: true });
      const mintPk = new PublicKey(tokenMeta.mint);
      const programId = await detectTokenProgram(this.conn, mintPk);
      const altProgramId = programId.equals(TOKEN_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
      const ownerIsOffCurve = isOffCurve(ownerPk);
      ownerAtaMain = await getAssociatedTokenAddress(
        mintPk, ownerPk, ownerIsOffCurve, programId, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      ownerAtaAlt = await getAssociatedTokenAddress(
        mintPk, ownerPk, ownerIsOffCurve, altProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
      );
    }

    const fmtLamports = (lamportsBI) => {
      const base = BigInt(1000000000);
      const whole = (lamportsBI / base).toString(10);
      const frac = (lamportsBI % base).toString(10).padStart(9, '0').replace(/0+$/, '');
      return frac ? `${whole}.${frac}` : whole;
    };

    const items = [];
    for (let i = 0; i < parsed.length; i++) {
      const ptx = parsed[i];
      const sig = signatures[i];
      if (!ptx) continue;

      const blockTime = ptx.blockTime != null ? Number(ptx.blockTime) : undefined;
      const ts = blockTime ? new Date(blockTime * 1000).toISOString() : undefined;
      const explorerUrl = this.deps?.explorerBaseUrl
        ? `${this.deps.explorerBaseUrl.replace(/\/+$/, '')}/tx/${sig}`
        : undefined;

      // ---------------- TOKEN MODE ----------------
      if (tokenAddress && tokenMeta) {
        const dec = Number(tokenMeta.decimals ?? 9);
        const mintLc = tokenMeta.mint.toLowerCase();
        const ixAll = [
          ...(ptx.transaction?.message?.instructions || []),
          ...((ptx.meta?.innerInstructions || []).flatMap(ii => ii.instructions) || []),
        ];

        let direction = null;
        let uiAmountStr = null;
        let fromTokAcc = null;
        let toTokAcc = null;

        for (const ix of ixAll) {
          const parsedIx = ix?.parsed;
          if (!parsedIx || (parsedIx.type !== 'transfer' && parsedIx.type !== 'transferChecked'))
            continue;

          const info = parsedIx.info || {};
          const mint = (info.mint || '').toString().toLowerCase();
          if (!mint || mint !== mintLc) continue;

          const source = info.source;
          const destination = info.destination;
          if (!source || !destination) continue;

          const amountRaw =
            info.tokenAmount?.amount ??
            info.amount ??
            null;
          if (amountRaw == null) continue;

          const amountBI = BigInt(String(amountRaw));
          const base = BigInt(10) ** BigInt(dec);
          const whole = (amountBI / base).toString(10);
          const frac = (amountBI % base).toString(10).padStart(dec, '0').replace(/0+$/, '');
          uiAmountStr = frac ? `${whole}.${frac}` : whole;

          const isFromMe =
            source === ownerAtaMain?.toBase58() || source === ownerAtaAlt?.toBase58();
          const isToMe =
            destination === ownerAtaMain?.toBase58() || destination === ownerAtaAlt?.toBase58();

          if (isFromMe && !isToMe) {
            direction = 'out';
            fromTokAcc = source;
            toTokAcc = destination;
            break;
          }
          if (isToMe && !isFromMe) {
            direction = 'in';
            fromTokAcc = source;
            toTokAcc = destination;
            break;
          }
        }

        if (direction && uiAmountStr) {
          items.push({
            hash: sig,
            direction,
            value: uiAmountStr,
            symbol: tokenMeta.symbol || 'SPL',
            timestamp: ts,
            explorerUrl,
            from: fromTokAcc,
            to: toTokAcc,
            blockNumber: ptx.slot,
            status: ptx.meta?.err ? 'failed' : 'success',
          });
        }
        continue;
      }

      // ---------------- NATIVE SOL MODE ----------------
      const keys =
        ptx.transaction?.message?.accountKeys?.map(
          (k) => k.pubkey?.toBase58?.() || k.toBase58()
        ) || [];
      const ownerIdx = keys.findIndex((k) => k === ownerAddr);
      if (ownerIdx === -1) continue;

      const pre = Array.isArray(ptx.meta?.preBalances)
        ? BigInt(ptx.meta.preBalances[ownerIdx] ?? 0)
        : null;
      const post = Array.isArray(ptx.meta?.postBalances)
        ? BigInt(ptx.meta.postBalances[ownerIdx] ?? 0)
        : null;
      if (pre == null || post == null) continue;

      const delta = post - pre;
      if (delta === BigInt(0)) continue;

      const abs = delta > BigInt(0) ? delta : -delta;
      items.push({
        hash: sig,
        direction: delta > BigInt(0) ? 'in' : 'out',
        value: fmtLamports(abs),
        symbol: 'SOL',
        timestamp: ts,
        explorerUrl,
        blockNumber: ptx.slot,
        status: ptx.meta?.err ? 'failed' : 'success',
      });
    }
    const nextCursor = sigs.length > 0 ? sigs[sigs.length - 1].signature : undefined;
    return { items, cursor: nextCursor };
  }
}
