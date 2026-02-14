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

/* ------------------------------ constants ------------------------------ */

// Minimum SOL balance to keep in account for rent-exempt (0.00089088 SOL)
// This is the minimum balance required to keep an account rent-exempt
const MIN_RENT_EXEMPT_BALANCE = BigInt(890880); // lamports (~0.00089 SOL)

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
    
    // Hardcoded mapping for known Solana X tokens (lowercase -> original case-sensitive)
    const SOLANA_ADDRESS_MAP = {
      'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': 'CAwhZLDxHVVuKDYrxpYHsTg3Y3ABNmix4e2oW2Ududa4', // XUSDT
      '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': '5Rn5TGpwsizxGsynsfv8hBAQvX1kfZcGWJDTNmGtx9K8', // JYB
      '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': '3b7uqjyw9gxoaM6EJpBYE3ee93cfAbtNUAvZ5iof1RqF', // BTC
      '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': '3c8jjrxrVcGERxboVVKDhBzHHWgYB6BfZuwSdhpuJELL', // ETH
      'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': 'C7za45teP96BQEbRXgQi5bGN4gVM2iqo3z41rpFPdh4a', // LTC
      '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': '7XraejVhjM1qrzpqfDfuSu9ZqxQvZbKLDDDPc5c3wfQD', // DOGE
      '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': '4mTty3JfcuYHhHQNojf66bxpReHwQcBMDwAwQoNAuHqh', // USDC
      'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': 'DDNuH16bNVrzYMeLHztQgc3LDVMSasoeuF8zi8XNTQrh', // SLX
    };
    
    // Use original case-sensitive address if available
    const originalMint = SOLANA_ADDRESS_MAP[mintLc] || mint;
    
    // Hardcoded decimals for known Solana X tokens
    const SOLANA_X_DECIMALS = {
      'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': 9, // XUSDT
      '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': 6, // JYB
      '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': 6, // BTC
      '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': 6, // ETH
      'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': 6, // LTC
      '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': 6, // DOGE
      '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': 6, // USDC
      'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': 6, // SLX
    };
    
    let decimals = meta.decimals;

    // Use hardcoded decimals for known tokens, or fetch from chain
    if (SOLANA_X_DECIMALS[mintLc] !== undefined) {
      decimals = SOLANA_X_DECIMALS[mintLc];
    } else if (decimals == null) {
      try {
        const mintPk = new PublicKey(originalMint);
        const supply = await this.conn.getTokenSupply(mintPk);
        decimals = Number(supply?.value?.decimals ?? 9);
      } catch (e) {
        decimals = 9; // default
      }
    }

    this._tokens.set(mintLc, {
      mint: originalMint,
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

    // Hardcoded meta for known Solana X tokens (in case not registered)
    const SOLANA_X_TOKEN_META = {
      'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': { mint: 'CAwhZLDxHVVuKDYrxpYHsTg3Y3ABNmix4e2oW2Ududa4', symbol: 'XUSDT', decimals: 9 },
      '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': { mint: '5Rn5TGpwsizxGsynsfv8hBAQvX1kfZcGWJDTNmGtx9K8', symbol: 'JYB', decimals: 9 },
      '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': { mint: '3b7uqjyw9gxoaM6EJpBYE3ee93cfAbtNUAvZ5iof1RqF', symbol: 'BTC', decimals: 8 },
      '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': { mint: '3c8jjrxrVcGERxboVVKDhBzHHWgYB6BfZuwSdhpuJELL', symbol: 'ETH', decimals: 8 },
      'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': { mint: 'C7za45teP96BQEbRXgQi5bGN4gVM2iqo3z41rpFPdh4a', symbol: 'LTC', decimals: 8 },
      '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': { mint: '7XraejVhjM1qrzpqfDfuSu9ZqxQvZbKLDDDPc5c3wfQD', symbol: 'DOGE', decimals: 8 },
      '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': { mint: '4mTty3JfcuYHhHQNojf66bxpReHwQcBMDwAwQoNAuHqh', symbol: 'USDC', decimals: 6 },
      'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': { mint: 'DDNuH16bNVrzYMeLHztQgc3LDVMSasoeuF8zi8XNTQrh', symbol: 'SLX', decimals: 9 },
    };
    
    if (SOLANA_X_TOKEN_META[key]) {
      return SOLANA_X_TOKEN_META[key];
    }

    if (!allowLazy) throw new WalletError('UNKNOWN_TOKEN', 'Token not registered');

    // Lazy: infer decimals via getTokenSupply (works for SPL + 2022)
    // Use the original mintOrAddress (case-sensitive) for PublicKey
    try {
      const mintPk = new PublicKey(mintOrAddress);
      const sup = await this.conn.getTokenSupply(mintPk);
      const decimals = Number(sup?.value?.decimals ?? 9);
      const out = { mint: mintOrAddress, symbol: 'SPL', decimals };
      // you can cache: this._tokens.set(key, out);
      return out;
    } catch (e) {
      // If mintOrAddress is lowercase, try to find original from registry
      throw new WalletError('INVALID_TOKEN', `Invalid token address: ${mintOrAddress}. Error: ${e.message}`);
    }
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
    
    // Try to get original case-sensitive address from registered tokens
    let mintAddress = mint;
    const mintKey = String(mint).toLowerCase();
    const registeredToken = this._tokens.get(mintKey);
    if (registeredToken?.mint) {
      mintAddress = registeredToken.mint;
    }
    
    // Hardcoded mapping for known Solana X tokens (lowercase -> original)
    const SOLANA_ADDRESS_MAP = {
      'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': 'CAwhZLDxHVVuKDYrxpYHsTg3Y3ABNmix4e2oW2Ududa4', // XUSDT
      '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': '5Rn5TGpwsizxGsynsfv8hBAQvX1kfZcGWJDTNmGtx9K8', // JYB
      '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': '3b7uqjyw9gxoaM6EJpBYE3ee93cfAbtNUAvZ5iof1RqF', // BTC
      '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': '3c8jjrxrVcGERxboVVKDhBzHHWgYB6BfZuwSdhpuJELL', // ETH
      'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': 'C7za45teP96BQEbRXgQi5bGN4gVM2iqo3z41rpFPdh4a', // LTC
      '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': '7XraejVhjM1qrzpqfDfuSu9ZqxQvZbKLDDDPc5c3wfQD', // DOGE
      '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': '4mTty3JfcuYHhHQNojf66bxpReHwQcBMDwAwQoNAuHqh', // USDC
      'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': 'DDNuH16bNVrzYMeLHztQgc3LDVMSasoeuF8zi8XNTQrh', // SLX
    };
    
    // If address is lowercase, try to get original from map
    if (mintAddress === mintAddress.toLowerCase() && SOLANA_ADDRESS_MAP[mintKey]) {
      mintAddress = SOLANA_ADDRESS_MAP[mintKey];
    }
    
    let mintPk;
    try {
      mintPk = new PublicKey(mintAddress);
    } catch (e) {
      console.warn('[SolWallet] Invalid mint address for balance:', mint, e.message);
      return { total: '0', decimals: 0, symbol: 'SPL' };
    }

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
        // Check if platform fee receiver has enough balance for rent-exempt
        try {
          const pfReceiverPk = new PublicKey(intent.platformFee.receiver);
          const pfReceiverBalance = await this.conn.getBalance(pfReceiverPk);
          
          // Only add platform fee if receiver has rent-exempt balance
          if (pfReceiverBalance >= Number(MIN_RENT_EXEMPT_BALANCE)) {
            ixns.push(SystemProgram.transfer({
              fromPubkey: payer,
              toPubkey: pfReceiverPk,
              lamports: platformFeeBase,
            }));
          }
        } catch (e) {
          // Skip platform fee on error
        }
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
      // CRITICAL FIX: Reserve minimum balance for rent-exempt
      // Get current balance
      const currentBalance = await this.conn.getBalance(payer);
      const currentBalanceBN = BigInt(currentBalance);
      
      const mainLamports = willReduceAmount
        ? (amountBase > platformFeeBase ? amountBase - platformFeeBase : ZERO)
        : amountBase;

      // Check recipient account - if it doesn't exist or has 0 balance, 
      // we need to ensure we send enough for rent-exempt
      let recipientNeedsRent = false;
      try {
        const recipientPubkey = new PublicKey(intent.to);
        const recipientBalance = await this.conn.getBalance(recipientPubkey);
        
        // If recipient has no balance or very low balance, they need rent-exempt amount
        if (recipientBalance < Number(MIN_RENT_EXEMPT_BALANCE)) {
          recipientNeedsRent = true;
          
          // Ensure we're sending at least rent-exempt amount
          if (mainLamports < MIN_RENT_EXEMPT_BALANCE) {
            throw new WalletError(
              'INSUFFICIENT_AMOUNT',
              `Recipient account needs at least ${fromLamports(MIN_RENT_EXEMPT_BALANCE)} SOL (${fromLamports(MIN_RENT_EXEMPT_BALANCE)} SOL for rent-exempt). You're trying to send ${fromLamports(mainLamports)} SOL.`
            );
          }
        }
      } catch (e) {
        // If we can't check recipient, assume they need rent
        if (e instanceof WalletError) throw e;
        recipientNeedsRent = true;
      }

      // Calculate total lamports needed from sender
      // (amount + platform fee + network fee + sender's rent reserve)
      const totalNeeded = mainLamports + 
                         (willReduceAmount ? ZERO : platformFeeBase) + 
                         BigInt(5000) + // estimated network fee
                         MIN_RENT_EXEMPT_BALANCE; // sender's rent reserve
      
      // Check if sender has enough balance
      if (currentBalanceBN < totalNeeded) {
        throw new WalletError(
          'INSUFFICIENT_FUNDS',
          `Insufficient funds. Need ${fromLamports(totalNeeded)} SOL (including ${fromLamports(MIN_RENT_EXEMPT_BALANCE)} SOL rent reserve for your account), but only have ${fromLamports(currentBalanceBN)} SOL`
        );
      }

      if (mainLamports > ZERO) {
        ixns.push(SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(intent.to),
          lamports: BigInt(mainLamports),
        }));
      }

      if (platformFeeBase > ZERO && !willReduceAmount && pf?.receiver) {
        // Check if platform fee receiver has enough balance for rent-exempt
        try {
          const pfReceiverPk = new PublicKey(pf.receiver);
          const pfReceiverBalance = await this.conn.getBalance(pfReceiverPk);
          
          // If platform fee receiver doesn't have rent-exempt balance,
          // skip the platform fee to avoid transaction failure
          if (pfReceiverBalance < Number(MIN_RENT_EXEMPT_BALANCE)) {
            console.warn('[SolWallet] Platform fee receiver has insufficient balance for rent, skipping platform fee');
            // Don't add platform fee instruction - skip it
          } else {
            ixns.push(SystemProgram.transfer({
              fromPubkey: payer,
              toPubkey: pfReceiverPk,
              lamports: BigInt(platformFeeBase),
            }));
          }
        } catch (e) {
          console.warn('[SolWallet] Failed to check platform fee receiver balance, skipping platform fee:', e.message);
          // Skip platform fee on error
        }
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
    
    console.log('🔍 [SolWallet] getTransactionHistory called:', {
      ownerAddr,
      tokenAddress,
      limit,
      cursor: cursor ? cursor.slice(0, 8) + '...' : 'none'
    });
    
    // Try Solscan API first (faster and more reliable)
    try {
      console.log('🌐 [SolWallet] Trying Solscan API first...');
      const solscanResult = await this.#getHistoryFromSolscan({
        address: ownerAddr,
        tokenAddress,
        limit,
        cursor,
      });
      
      if (solscanResult && solscanResult.items && solscanResult.items.length > 0) {
        console.log('✅ [SolWallet] Solscan API success - returning results');
        return solscanResult;
      }
      
      console.log('⚠️ [SolWallet] Solscan API returned empty, falling back to RPC...');
    } catch (solscanError) {
      console.warn('⚠️ [SolWallet] Solscan API failed, falling back to RPC:', solscanError.message);
    }
    
    // Fallback to RPC method
    console.log('🔄 [SolWallet] Using RPC fallback method...');
    
    let sigs = [];
    
    // FOR SPL TOKENS: Fetch signatures from token accounts (ATAs), not wallet address
    // This is the fix recommended by Chainstack support
    if (tokenAddress) {
      console.log('🔑 [SolWallet] Token mode - fetching from token accounts (ATAs)...');
      
      try {
        // Resolve token meta to get mint address
        const tokenKey = String(tokenAddress).toLowerCase();
        const SOLANA_ADDRESS_MAP = {
          'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': 'CAwhZLDxHVVuKDYrxpYHsTg3Y3ABNmix4e2oW2Ududa4',
          '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': '5Rn5TGpwsizxGsynsfv8hBAQvX1kfZcGWJDTNmGtx9K8',
          '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': '3b7uqjyw9gxoaM6EJpBYE3ee93cfAbtNUAvZ5iof1RqF',
          '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': '3c8jjrxrVcGERxboVVKDhBzHHWgYB6BfZuwSdhpuJELL',
          'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': 'C7za45teP96BQEbRXgQi5bGN4gVM2iqo3z41rpFPdh4a',
          '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': '7XraejVhjM1qrzpqfDfuSu9ZqxQvZbKLDDDPc5c3wfQD',
          '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': '4mTty3JfcuYHhHQNojf66bxpReHwQcBMDwAwQoNAuHqh',
          'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': 'DDNuH16bNVrzYMeLHztQgc3LDVMSasoeuF8zi8XNTQrh',
        };
        
        let mintAddress = SOLANA_ADDRESS_MAP[tokenKey];
        if (!mintAddress) {
          const registeredToken = this._tokens.get(tokenKey);
          mintAddress = registeredToken?.mint || tokenAddress;
        }
        
        const mintPk = new PublicKey(mintAddress);
        
        // Get all token accounts for this wallet + mint
        console.log('📦 [SolWallet] Getting token accounts for mint:', mintAddress);
        const tokenAccounts = await this.conn.getTokenAccountsByOwner(ownerPk, { mint: mintPk });
        
        console.log('📦 [SolWallet] Found token accounts:', tokenAccounts.value.length);
        
        if (tokenAccounts.value.length === 0) {
          console.warn('⚠️ [SolWallet] No token accounts found for this mint');
          return { items: [], cursor: undefined };
        }
        
        // Fetch signatures from each token account
        const sigPromises = tokenAccounts.value.map(async (accountInfo) => {
          const tokenAccountPubkey = accountInfo.pubkey;
          console.log('🔍 [SolWallet] Fetching signatures for token account:', tokenAccountPubkey.toBase58().slice(0, 8) + '...');
          
          try {
            const accountSigs = await this.conn.getSignaturesForAddress(tokenAccountPubkey, { limit, before });
            console.log('  ✅ Found', accountSigs.length, 'signatures');
            return accountSigs;
          } catch (err) {
            console.warn('  ⚠️ Failed to fetch signatures:', err.message);
            return [];
          }
        });
        
        const allSigsArrays = await Promise.all(sigPromises);
        
        // Merge all signatures
        const mergedSigs = allSigsArrays.flat();
        console.log('📋 [SolWallet] Total signatures from all token accounts:', mergedSigs.length);
        
        // Dedupe by signature
        const seenSigs = new Set();
        const dedupedSigs = [];
        for (const sig of mergedSigs) {
          if (!seenSigs.has(sig.signature)) {
            seenSigs.add(sig.signature);
            dedupedSigs.push(sig);
          }
        }
        
        console.log('📋 [SolWallet] After deduplication:', dedupedSigs.length, 'unique signatures');
        
        // Sort by slot descending (newest first)
        dedupedSigs.sort((a, b) => (b.slot || 0) - (a.slot || 0));
        
        // Take only 'limit' signatures
        sigs = dedupedSigs.slice(0, limit);
        
        console.log('📋 [SolWallet] Final signatures to process:', sigs.length);
        
      } catch (error) {
        console.error('❌ [SolWallet] Error fetching token account signatures:', error);
        return { items: [], cursor: undefined };
      }
    } else {
      // FOR NATIVE SOL: Fetch from wallet address (original method)
      console.log('💰 [SolWallet] Native SOL mode - fetching from wallet address...');
      sigs = await this.conn.getSignaturesForAddress(ownerPk, { limit, before });
    }
    
    console.log('📝 [SolWallet] Found signatures from RPC:', sigs.length);
    
    if (!Array.isArray(sigs) || sigs.length === 0) {
      console.log('⚠️ [SolWallet] No signatures found from RPC');
      return { items: [], cursor: undefined };
    }

    const signatures = sigs.map((s) => s.signature);
    const parsed = await this.conn.getParsedTransactions(signatures, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    
    console.log('📦 [SolWallet] Parsed transactions:', parsed.length);
    console.log('🎯 [SolWallet] Token mode:', tokenAddress ? 'YES - ' + tokenAddress : 'NO (native SOL)');

    // Precompute token context if applicable
    let tokenMeta = null;
    let ownerAtaMain = null;
    let ownerAtaAlt = null;
    if (tokenAddress) {
      // Hardcoded mapping for known Solana X tokens (lowercase -> original case-sensitive)
      const SOLANA_ADDRESS_MAP = {
        'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': 'CAwhZLDxHVVuKDYrxpYHsTg3Y3ABNmix4e2oW2Ududa4', // XUSDT
        '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': '5Rn5TGpwsizxGsynsfv8hBAQvX1kfZcGWJDTNmGtx9K8', // JYB
        '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': '3b7uqjyw9gxoaM6EJpBYE3ee93cfAbtNUAvZ5iof1RqF', // BTC
        '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': '3c8jjrxrVcGERxboVVKDhBzHHWgYB6BfZuwSdhpuJELL', // ETH
        'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': 'C7za45teP96BQEbRXgQi5bGN4gVM2iqo3z41rpFPdh4a', // LTC
        '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': '7XraejVhjM1qrzpqfDfuSu9ZqxQvZbKLDDDPc5c3wfQD', // DOGE
        '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': '4mTty3JfcuYHhHQNojf66bxpReHwQcBMDwAwQoNAuHqh', // USDC
        'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': 'DDNuH16bNVrzYMeLHztQgc3LDVMSasoeuF8zi8XNTQrh', // SLX
      };
      
      const tokenKey = String(tokenAddress).toLowerCase();
      
      // Priority: 1. Hardcoded map, 2. Registered token, 3. Original input
      let mintAddress = SOLANA_ADDRESS_MAP[tokenKey];
      if (!mintAddress) {
        const registeredToken = this._tokens.get(tokenKey);
        mintAddress = registeredToken?.mint || tokenAddress;
      }
      
      try {
        tokenMeta = await this.#resolveTokenMeta(mintAddress, { allowLazy: true });
        const mintPk = new PublicKey(tokenMeta.mint);
        
        // Try to detect token program, fallback to TOKEN_PROGRAM_ID if fails
        let programId = TOKEN_PROGRAM_ID;
        try {
          programId = await detectTokenProgram(this.conn, mintPk);
        } catch (detectErr) {
          console.warn('[SolWallet] Could not detect token program, using default SPL:', detectErr.message);
        }
        
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
        
        console.log('🔑 [SolWallet] Token ATAs:', {
          ownerAtaMain: ownerAtaMain?.toBase58(),
          ownerAtaAlt: ownerAtaAlt?.toBase58(),
        });
      } catch (e) {
        // Token meta resolution failed - return empty history
        console.warn('[SolWallet] Failed to resolve token for history:', mintAddress, e.message);
        return { items: [], cursor: undefined };
      }
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
        
        console.log(`📋 [SolWallet] Transaction ${sig.slice(0, 8)}... has ${ixAll.length} instructions`);

        let direction = null;
        let uiAmountStr = null;
        let fromTokAcc = null;
        let toTokAcc = null;

        for (const ix of ixAll) {
          const parsedIx = ix?.parsed;
          if (!parsedIx) {
            console.log(`  ⚠️ Unparsed instruction:`, ix?.program || 'unknown');
            continue;
          }
          
          if (parsedIx.type !== 'transfer' && parsedIx.type !== 'transferChecked') {
            console.log(`  ℹ️ Non-transfer instruction: ${parsedIx.type}`);
            continue;
          }

          const info = parsedIx.info || {};
          
          // For 'transfer' type, mint is not in info - we need to check by ATA
          // For 'transferChecked' type, mint is in info
          const mint = (info.mint || '').toString().toLowerCase();
          
          const source = info.source;
          const destination = info.destination;
          if (!source || !destination) continue;

          // Check if this transfer involves our token's ATA
          const isFromMyAta = source === ownerAtaMain?.toBase58() || source === ownerAtaAlt?.toBase58();
          const isToMyAta = destination === ownerAtaMain?.toBase58() || destination === ownerAtaAlt?.toBase58();
          
          console.log('🔄 [SolWallet] Checking transfer:', {
            sig: sig.slice(0, 8) + '...',
            type: parsedIx.type,
            source: source?.slice(0, 8) + '...',
            destination: destination?.slice(0, 8) + '...',
            isFromMyAta,
            isToMyAta,
            mint: mint ? mint.slice(0, 8) + '...' : 'none',
          });
          
          // Skip if not related to our ATAs
          if (!isFromMyAta && !isToMyAta) {
            console.log('  ⏭️ Skipped: Not related to our ATAs');
            continue;
          }
          
          // For transferChecked, verify mint matches
          if (parsedIx.type === 'transferChecked' && mint && mint !== mintLc) {
            console.log('  ⏭️ Skipped: Mint mismatch');
            continue;
          }

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

          if (isFromMyAta && !isToMyAta) {
            direction = 'out';
            fromTokAcc = source;
            toTokAcc = destination;
            console.log('  📤 Direction: OUT');
            break;
          }
          if (isToMyAta && !isFromMyAta) {
            direction = 'in';
            fromTokAcc = source;
            toTokAcc = destination;
            console.log('  📥 Direction: IN');
            break;
          }
        }

        if (direction && uiAmountStr) {
          console.log('✅ [SolWallet] Adding token tx:', { direction, value: uiAmountStr, symbol: tokenMeta.symbol });
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
        } else {
          console.log('⚠️ [SolWallet] Skipped token tx:', { direction, uiAmountStr });
        }
        continue;
      }

      // ---------------- NATIVE SOL MODE ----------------
      const keys =
        ptx.transaction?.message?.accountKeys?.map(
          (k) => k.pubkey?.toBase58?.() || k.toBase58()
        ) || [];
      const ownerIdx = keys.findIndex((k) => k === ownerAddr);
      
      console.log('💰 [SolWallet] Checking native SOL tx:', {
        sig: sig.slice(0, 8) + '...',
        ownerIdx,
        totalKeys: keys.length,
      });
      
      if (ownerIdx === -1) {
        console.log('  ⏭️ Skipped: Owner not in keys');
        continue;
      }

      const pre = Array.isArray(ptx.meta?.preBalances)
        ? BigInt(ptx.meta.preBalances[ownerIdx] ?? 0)
        : null;
      const post = Array.isArray(ptx.meta?.postBalances)
        ? BigInt(ptx.meta.postBalances[ownerIdx] ?? 0)
        : null;
      if (pre == null || post == null) {
        console.log('  ⏭️ Skipped: No balance data');
        continue;
      }

      const delta = post - pre;
      if (delta === BigInt(0)) {
        console.log('  ⏭️ Skipped: Zero delta');
        continue;
      }

      const abs = delta > BigInt(0) ? delta : -delta;
      const direction = delta > BigInt(0) ? 'in' : 'out';
      console.log('✅ [SolWallet] Adding native SOL tx:', { direction, delta: delta.toString() });
      
      items.push({
        hash: sig,
        direction,
        value: fmtLamports(abs),
        symbol: 'SOL',
        timestamp: ts,
        explorerUrl,
        blockNumber: ptx.slot,
        status: ptx.meta?.err ? 'failed' : 'success',
      });
    }
    
    const nextCursor = sigs.length > 0 ? sigs[sigs.length - 1].signature : undefined;
    console.log('🏁 [SolWallet] getTransactionHistory complete:', {
      totalItems: items.length,
      incomingCount: items.filter(i => i.direction === 'in').length,
      outgoingCount: items.filter(i => i.direction === 'out').length,
      nextCursor: nextCursor ? nextCursor.slice(0, 8) + '...' : 'none',
    });
    
    return { items, cursor: nextCursor };
  }

  /**
   * Get transaction history from Solscan API (faster and more reliable than RPC)
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    
    console.log('📦 [SolWallet] Parsed transactions:', parsed.length);
    console.log('🎯 [SolWallet] Token mode:', tokenAddress ? 'YES - ' + tokenAddress : 'NO (native SOL)');

    // Precompute token context if applicable
    let tokenMeta = null;
    let ownerAtaMain = null;
    let ownerAtaAlt = null;
    if (tokenAddress) {
      // Hardcoded mapping for known Solana X tokens (lowercase -> original case-sensitive)
      const SOLANA_ADDRESS_MAP = {
        'cawhzldxhvvukdyrxpyhstg3y3abnmix4e2ow2ududa4': 'CAwhZLDxHVVuKDYrxpYHsTg3Y3ABNmix4e2oW2Ududa4', // XUSDT
        '5rn5tgpwsizxgsynsfv8hbaqvx1kfzcgwjdtnmgtx9k8': '5Rn5TGpwsizxGsynsfv8hBAQvX1kfZcGWJDTNmGtx9K8', // JYB
        '3b7uqjyw9gxoam6ejpbye3ee93cfabtnuavz5iof1rqf': '3b7uqjyw9gxoaM6EJpBYE3ee93cfAbtNUAvZ5iof1RqF', // BTC
        '3c8jjrxrvcgerxbovvkdhbzhhwgyb6bfzuwsdhpujell': '3c8jjrxrVcGERxboVVKDhBzHHWgYB6BfZuwSdhpuJELL', // ETH
        'c7za45tep96bqebrxgqi5bgn4gvm2iqo3z41rpfpdh4a': 'C7za45teP96BQEbRXgQi5bGN4gVM2iqo3z41rpFPdh4a', // LTC
        '7xraejvhjm1qrzpqfdfusu9zqxqvzbkldddpc5c3wfqd': '7XraejVhjM1qrzpqfDfuSu9ZqxQvZbKLDDDPc5c3wfQD', // DOGE
        '4mtty3jfcuyhhhqnojf66bxprehwqcbmdwawqonauqhh': '4mTty3JfcuYHhHQNojf66bxpReHwQcBMDwAwQoNAuHqh', // USDC
        'ddnuh16bnvrzymelhztqgc3ldvmsasoeuuf8zi8xntqrh': 'DDNuH16bNVrzYMeLHztQgc3LDVMSasoeuF8zi8XNTQrh', // SLX
      };
      
      const tokenKey = String(tokenAddress).toLowerCase();
      
      // Priority: 1. Hardcoded map, 2. Registered token, 3. Original input
      let mintAddress = SOLANA_ADDRESS_MAP[tokenKey];
      if (!mintAddress) {
        const registeredToken = this._tokens.get(tokenKey);
        mintAddress = registeredToken?.mint || tokenAddress;
      }
      
      try {
        tokenMeta = await this.#resolveTokenMeta(mintAddress, { allowLazy: true });
        const mintPk = new PublicKey(tokenMeta.mint);
        
        // Try to detect token program, fallback to TOKEN_PROGRAM_ID if fails
        let programId = TOKEN_PROGRAM_ID;
        try {
          programId = await detectTokenProgram(this.conn, mintPk);
        } catch (detectErr) {
          console.warn('[SolWallet] Could not detect token program, using default SPL:', detectErr.message);
        }
        
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
        
        console.log('🔑 [SolWallet] Token ATAs:', {
          ownerAtaMain: ownerAtaMain?.toBase58(),
          ownerAtaAlt: ownerAtaAlt?.toBase58(),
        });
      } catch (e) {
        // Token meta resolution failed - return empty history
        console.warn('[SolWallet] Failed to resolve token for history:', mintAddress, e.message);
        return { items: [], cursor: undefined };
      }
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
        
        console.log(`📋 [SolWallet] Transaction ${sig.slice(0, 8)}... has ${ixAll.length} instructions`);

        let direction = null;
        let uiAmountStr = null;
        let fromTokAcc = null;
        let toTokAcc = null;

        for (const ix of ixAll) {
          const parsedIx = ix?.parsed;
          if (!parsedIx) {
            console.log(`  ⚠️ Unparsed instruction:`, ix?.program || 'unknown');
            continue;
          }
          
          if (parsedIx.type !== 'transfer' && parsedIx.type !== 'transferChecked') {
            console.log(`  ℹ️ Non-transfer instruction: ${parsedIx.type}`);
            continue;
          }

          const info = parsedIx.info || {};
          
          // For 'transfer' type, mint is not in info - we need to check by ATA
          // For 'transferChecked' type, mint is in info
          const mint = (info.mint || '').toString().toLowerCase();
          
          const source = info.source;
          const destination = info.destination;
          if (!source || !destination) continue;

          // Check if this transfer involves our token's ATA
          const isFromMyAta = source === ownerAtaMain?.toBase58() || source === ownerAtaAlt?.toBase58();
          const isToMyAta = destination === ownerAtaMain?.toBase58() || destination === ownerAtaAlt?.toBase58();
          
          console.log('🔄 [SolWallet] Checking transfer:', {
            sig: sig.slice(0, 8) + '...',
            type: parsedIx.type,
            source: source?.slice(0, 8) + '...',
            destination: destination?.slice(0, 8) + '...',
            isFromMyAta,
            isToMyAta,
            mint: mint ? mint.slice(0, 8) + '...' : 'none',
          });
          
          // Skip if not related to our ATAs
          if (!isFromMyAta && !isToMyAta) {
            console.log('  ⏭️ Skipped: Not related to our ATAs');
            continue;
          }
          
          // For transferChecked, verify mint matches
          if (parsedIx.type === 'transferChecked' && mint && mint !== mintLc) {
            console.log('  ⏭️ Skipped: Mint mismatch');
            continue;
          }

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

          if (isFromMyAta && !isToMyAta) {
            direction = 'out';
            fromTokAcc = source;
            toTokAcc = destination;
            console.log('  📤 Direction: OUT');
            break;
          }
          if (isToMyAta && !isFromMyAta) {
            direction = 'in';
            fromTokAcc = source;
            toTokAcc = destination;
            console.log('  📥 Direction: IN');
            break;
          }
        }

        if (direction && uiAmountStr) {
          console.log('✅ [SolWallet] Adding token tx:', { direction, value: uiAmountStr, symbol: tokenMeta.symbol });
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
        } else {
          console.log('⚠️ [SolWallet] Skipped token tx:', { direction, uiAmountStr });
        }
        continue;
      }

      // ---------------- NATIVE SOL MODE ----------------
      const keys =
        ptx.transaction?.message?.accountKeys?.map(
          (k) => k.pubkey?.toBase58?.() || k.toBase58()
        ) || [];
      const ownerIdx = keys.findIndex((k) => k === ownerAddr);
      
      console.log('💰 [SolWallet] Checking native SOL tx:', {
        sig: sig.slice(0, 8) + '...',
        ownerIdx,
        totalKeys: keys.length,
      });
      
      if (ownerIdx === -1) {
        console.log('  ⏭️ Skipped: Owner not in keys');
        continue;
      }

      const pre = Array.isArray(ptx.meta?.preBalances)
        ? BigInt(ptx.meta.preBalances[ownerIdx] ?? 0)
        : null;
      const post = Array.isArray(ptx.meta?.postBalances)
        ? BigInt(ptx.meta.postBalances[ownerIdx] ?? 0)
        : null;
      if (pre == null || post == null) {
        console.log('  ⏭️ Skipped: No balance data');
        continue;
      }

      const delta = post - pre;
      if (delta === BigInt(0)) {
        console.log('  ⏭️ Skipped: Zero delta');
        continue;
      }

      const abs = delta > BigInt(0) ? delta : -delta;
      const direction = delta > BigInt(0) ? 'in' : 'out';
      console.log('✅ [SolWallet] Adding native SOL tx:', { direction, delta: delta.toString() });
      
      items.push({
        hash: sig,
        direction,
        value: fmtLamports(abs),
        symbol: 'SOL',
        timestamp: ts,
        explorerUrl,
        blockNumber: ptx.slot,
        status: ptx.meta?.err ? 'failed' : 'success',
      });
    }
    
    const nextCursor = sigs.length > 0 ? sigs[sigs.length - 1].signature : undefined;
    console.log('🏁 [SolWallet] getTransactionHistory complete:', {
      totalItems: items.length,
      incomingCount: items.filter(i => i.direction === 'in').length,
      outgoingCount: items.filter(i => i.direction === 'out').length,
      nextCursor: nextCursor ? nextCursor.slice(0, 8) + '...' : 'none',
    });
    
    return { items, cursor: nextCursor };
  }

  /**
   * Get transaction history from Solscan API (faster and more reliable than RPC)
   * This is used as primary method, with RPC as fallback
   * @private
   */
  async #getHistoryFromSolscan({ address, tokenAddress, limit = 20, cursor }) {
    try {
      // Dynamic import axios to avoid bundling issues
      const axios = (await import('axios')).default;
      const baseUrl = 'https://api.solscan.io';
      
      let url;
      let params = {
        account: address,
        limit: limit,
      };
      
      if (cursor) {
        params.before = cursor;
      }
      
      if (tokenAddress) {
        // SPL token transfers
        url = `${baseUrl}/account/token/txs`;
        params.token = tokenAddress;
      } else {
        // Native SOL transfers  
        url = `${baseUrl}/account/transactions`;
      }
      
      console.log('🌐 [SolWallet] Fetching from Solscan:', { url, params });
      
      const response = await axios.get(url, { 
        params,
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.data || !Array.isArray(response.data.data)) {
        console.warn('⚠️ [SolWallet] Solscan returned invalid data format');
        return null;
      }
      
      const transactions = response.data.data;
      const items = [];
      
      for (const tx of transactions) {
        // Determine direction
        const isIncoming = tx.dst === address || tx.to === address;
        const isOutgoing = tx.src === address || tx.from === address;
        
        if (!isIncoming && !isOutgoing) continue;
        
        const direction = isIncoming ? 'in' : 'out';
        
        // Calculate value based on token or SOL
        let value;
        if (tokenAddress) {
          // Token transfer
          const decimals = tx.decimals || 9;
          value = (tx.amount / Math.pow(10, decimals)).toString();
        } else {
          // SOL transfer
          value = (tx.lamport / 1e9).toString();
        }
        
        items.push({
          hash: tx.txHash || tx.signature,
          direction,
          value,
          symbol: tokenAddress ? (tx.symbol || 'SPL') : 'SOL',
          timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : undefined,
          explorerUrl: `https://solscan.io/tx/${tx.txHash || tx.signature}`,
          from: tx.src || tx.from,
          to: tx.dst || tx.to,
          blockNumber: tx.slot,
          status: tx.status === 'Success' || tx.status === 1 ? 'success' : 'failed',
        });
      }
      
      // Get next cursor from last transaction
      const nextCursor = transactions.length > 0 
        ? transactions[transactions.length - 1].txHash || transactions[transactions.length - 1].signature
        : undefined;
      
      console.log('✅ [SolWallet] Solscan API returned:', {
        total: items.length,
        incoming: items.filter(i => i.direction === 'in').length,
        outgoing: items.filter(i => i.direction === 'out').length,
      });
      
      return { items, cursor: nextCursor };
    } catch (error) {
      console.error('❌ [SolWallet] Solscan API error:', error.message);
      // Return null to trigger RPC fallback
      return null;
    }
  }
}
