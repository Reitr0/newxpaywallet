// src/features/wallet/state/multiWalletStore.js
// Manages multiple wallet entries (each with its own mnemonic)
import { proxy } from 'valtio';
import db from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

const multiWalletDoc = db.doc('multiWallet.v1', {
  defaults: {
    wallets: [],    // Array<{ id, name, mnemonic, evmAddress, solAddress, btcAddress, createdAt }>
    activeId: null, // which wallet is currently active
  },
});

export const multiWalletStore = proxy({
  wallets: [],
  activeId: null,

  /** Load from disk */
  init() {
    try {
      const data = multiWalletDoc.get();
      this.wallets = Array.isArray(data?.wallets) ? data.wallets : [];
      this.activeId = data?.activeId || (this.wallets[0]?.id ?? null);
      console.log('[multiWalletStore] init:', this.wallets.length, 'wallets, active:', this.activeId);
    } catch (e) {
      log.warn('multiWalletStore.init failed', { message: e?.message });
    }
  },

  /** Register a wallet after successful init (called from walletStore flow) */
  addWallet({ id, name, mnemonic, evmAddress, solAddress, btcAddress }) {
    try {
      const existing = this.wallets.find(w => w.id === id);
      if (existing) {
        // Update existing
        Object.assign(existing, { name: name || existing.name, evmAddress, solAddress, btcAddress });
      } else {
        this.wallets.push({
          id,
          name: name || `Wallet ${this.wallets.length + 1}`,
          mnemonic,
          evmAddress: evmAddress || '',
          solAddress: solAddress || '',
          btcAddress: btcAddress || '',
          createdAt: Date.now(),
        });
      }

      // Set as active if first wallet
      if (!this.activeId) {
        this.activeId = id;
      }

      this._persist();
      console.log('[multiWalletStore] addWallet:', id, 'total:', this.wallets.length);
    } catch (e) {
      log.warn('multiWalletStore.addWallet failed', { message: e?.message });
    }
  },

  /** Switch the active wallet */
  setActive(id) {
    this.activeId = id;
    this._persist();
  },

  /** Get the active wallet entry */
  getActive() {
    return this.wallets.find(w => w.id === this.activeId) || this.wallets[0] || null;
  },

  /** Get wallet by id */
  getById(id) {
    return this.wallets.find(w => w.id === id) || null;
  },

  /** Remove a wallet */
  removeWallet(id) {
    this.wallets = this.wallets.filter(w => w.id !== id);
    if (this.activeId === id) {
      this.activeId = this.wallets[0]?.id || null;
    }
    this._persist();
  },

  /** Rename a wallet */
  renameWallet(id, newName) {
    const w = this.wallets.find(w => w.id === id);
    if (w) {
      w.name = newName;
      this._persist();
    }
  },

  _persist() {
    try {
      multiWalletDoc.set({
        wallets: this.wallets.map(w => ({ ...w })),
        activeId: this.activeId,
      });
    } catch (e) {
      log.warn('multiWalletStore._persist failed', { message: e?.message });
    }
  },
});
