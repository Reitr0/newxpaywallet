import log from '@src/shared/infra/log/logService';
import db from '@src/shared/infra/db/db';

import { bip39Service } from '@src/shared/lib/crypto/bip39';
import { HDNodeWallet } from 'ethers';

import * as btc from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import BIP32Factory from 'bip32';

import { derivePath as deriveEd25519Path } from 'ed25519-hd-key';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';
import bs58 from 'bs58';

import { TronWeb } from 'tronweb';
import { Keypair } from '@solana/web3.js';

/* ------------------ init curves / factories ------------------ */
btc.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
ed25519.hashes = ed25519.hashes || {};
ed25519.hashes.sha512 = sha512;

/* ------------------ Derivation paths ------------------ */
const PATHS = {
  ethereum: "m/44'/60'/0'/0/0",
  bsc:      "m/44'/60'/0'/0/0",
  polygon:  "m/44'/60'/0'/0/0",
  tron:     "m/44'/195'/0'/0/0",
  solana:   "m/44'/501'/0'/0'",
  bitcoin:  "m/84'/0'/0'/0/0", // BIP84 bech32 (P2WPKH)
};

const chainToLabel = {
  ethereum: 'Ethereum',
  bsc: 'Binance Smart Chain',
  polygon: 'Polygon',
  tron: 'Tron',
  solana: 'Solana',
  bitcoin: 'Bitcoin',
};

/* ------------------ Persistent storage ------------------ */

export const DEFAULT_KEYRING = {
  v: 1,
  mnemonic: '', // encrypted automatically by db.doc()
  meta: {
    createdAt: Date.now(),
    lastUnlockAt: 0,
    backedUp: false,
    wordCount: 0,
    locale: 'en',
  },
};

const keyringDoc = db.doc('keyring.v1', { defaults: DEFAULT_KEYRING });

/* ------------------ Service API ------------------ */

export const walletKeyringService = {
  /* --------- Storage (handled by db.doc) ---------- */
  get() {
    try {
      return keyringDoc.get() || { ...DEFAULT_KEYRING };
    } catch (e) {
      log.warn('walletKeyringService.get failed', { message: e?.message });
      return { ...DEFAULT_KEYRING };
    }
  },

  update(patch = {}) {
    try {
      const saved = keyringDoc.patch((cur) => ({ ...cur, ...patch }));
      log.debug('walletKeyringService.update ok', { keys: Object.keys(patch) });
      return saved;
    } catch (e) {
      log.warn('walletKeyringService.update failed', { message: e?.message });
      return this.get();
    }
  },

  reset() {
    try {
      return keyringDoc.reset();
    } catch (e) {
      log.warn('walletKeyringService.reset failed', { message: e?.message });
      return { ...DEFAULT_KEYRING };
    }
  },

  saveMnemonic(mnemonic, { wordCount = 12, locale = 'en' } = {}) {
    try {
      const rec = this.get();
      const saved = keyringDoc.set({
        ...DEFAULT_KEYRING,
        mnemonic,
        meta: {
          ...rec.meta,
          createdAt: rec.meta?.createdAt || Date.now(),
          wordCount,
          locale,
          backedUp: false,
          lastUnlockAt: 0,
        },
      });
      log.debug('walletKeyringService.saveMnemonic ok');
      return saved;
    } catch (e) {
      log.warn('walletKeyringService.saveMnemonic failed', { message: e?.message });
      return this.get();
    }
  },
  /**
   * Save mnemonic only if not already stored.
   * - If mnemonic exists, return the stored one.
   * - Otherwise, save and return the new mnemonic.
   */
  ensureMnemonic(mnemonic, { wordCount = 12, locale = 'en' } = {}) {
    try {
      const rec = this.get();

      // Already have a mnemonic saved
      if (rec?.mnemonic && rec.mnemonic.trim().length > 0) {
        log.debug('walletKeyringService.ensureMnemonic: mnemonic already exists');
        return rec.mnemonic;
      }

      // Save the new one
      const saved = keyringDoc.set({
        ...DEFAULT_KEYRING,
        mnemonic,
        meta: {
          ...rec.meta,
          createdAt: rec.meta?.createdAt || Date.now(),
          wordCount,
          locale,
          backedUp: false,
          lastUnlockAt: 0,
        },
      });

      log.debug('walletKeyringService.ensureMnemonic: mnemonic saved');
      return saved.mnemonic;
    } catch (e) {
      log.warn('walletKeyringService.ensureMnemonic failed', { message: e?.message });
      return mnemonic;
    }
  },
  markBackedUp() {
    try {
      return keyringDoc.patch((cur) => ({
        ...cur,
        meta: { ...cur.meta, backedUp: true },
      }));
    } catch (e) {
      log.warn('walletKeyringService.markBackedUp failed', { message: e?.message });
      return this.get();
    }
  },

  /* ----------------- Derivation helpers ----------------- */
  /**
   * Derive addresses/keys for all supported chains.
   * - If `mnemonic` is provided and none is stored yet, it will be saved first.
   * - If `mnemonic` is omitted/null, it derives from the stored mnemonic.
   * - Throws if neither is available.
   */
  async deriveAllChains(mnemonic, { wordCount = 12, locale = 'en' } = {}) {
    try {
      // 1) Ensure we have a mnemonic saved (or save the provided one once)
      const rec = this.get();
      let useMnemonic = rec?.mnemonic?.trim();

      if (!useMnemonic && mnemonic && mnemonic.trim().length > 0) {
        // save the first time
        const saved = keyringDoc.set({
          ...DEFAULT_KEYRING,
          mnemonic: mnemonic.trim(),
          meta: {
            ...rec.meta,
            createdAt: rec.meta?.createdAt || Date.now(),
            wordCount,
            locale,
            backedUp: false,
            lastUnlockAt: 0,
          },
        });
        useMnemonic = saved.mnemonic;
        log.debug('walletKeyringService.deriveAllChains: mnemonic saved before derive');
      }

      if (!useMnemonic) {
        throw new Error('No mnemonic available to derive from');
      }

      // 2) Proceed with derivation from the ensured/stored mnemonic
      const out = {};
      const seedBuf = bip39Service.mnemonicToSeed(useMnemonic, '');
      const seed =
        seedBuf instanceof Uint8Array ? seedBuf : new Uint8Array(Buffer.from(seedBuf));

      // ---- EVM chains ----
      const hdNode = HDNodeWallet.fromSeed(seed);
      for (const chain of ['ethereum', 'bsc', 'polygon']) {
        const path = PATHS[chain];
        const child = hdNode.derivePath(path);
        out[chain] = {
          address: child.address,
          privateKey: child.privateKey, // transient; do not persist
          path,
          tag: chainToLabel[chain],
        };
      }

      // ---- Tron ----
      {
        const path = PATHS.tron;
        const child = hdNode.derivePath(path);
        const tronAddress = TronWeb.address.fromHex(child.address);
        out.tron = {
          address: tronAddress,
          privateKey: child.privateKey,
          path,
          tag: chainToLabel.tron,
        };
      }

      // ---- Bitcoin (BIP84 p2wpkh) ----
      {
        const path = PATHS.bitcoin;
        const root = bip32.fromSeed(
          seedBuf instanceof Uint8Array ? Buffer.from(seedBuf) : seedBuf,
          btc.networks.bitcoin
        );
        const child = root.derivePath(path);
        const { address } = btc.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network: btc.networks.bitcoin,
        });
        out.bitcoin = {
          address,
          privateKey: child.privateKey,
          path,
          tag: chainToLabel.bitcoin,
        };
      }

      // ---- Solana (ed25519) ----
      {
        const path = PATHS.solana;
        const seedHex = Buffer.isBuffer(seed)
          ? seed.toString('hex')
          : Buffer.from(seed).toString('hex');
        const { key } = deriveEd25519Path(path, seedHex);
        const solAddr = Keypair.fromSeed(key).publicKey.toBase58();
        console.log(solAddr)
        out.solana = {
          address: solAddr,
          privateKey: key,
          path,
          tag: chainToLabel.solana,
        };
      }

      // 3) Touch lastUnlockAt (optional: shows recent usage)
      try {
        this.update({
          meta: { ...rec.meta, lastUnlockAt: Date.now() },
        });
      } catch {}

      return {mnemonic: useMnemonic, out};
    } catch (e) {
      log.warn('walletKeyringService.deriveAllChains failed', { message: e?.message });
      throw e;
    }
  },
};
