// src/features/wallet/service/walletService.js
import db from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

import { walletKeyringService } from '@features/wallet/service/walletKeyringService';
import { walletBuilder } from '@features/wallet/builder/walletBuilder';
import { networkStore } from '@features/network/state/networkStore';
import { WALLET_FAMILY } from '@src/shared/config/chain/constants';

export const DEFAULT_WALLETS = {
  ethereum: [],
  bsc: [],
  polygon: [],
  solana: [],
  tron: [],
  bitcoin: [],
};

const walletsDoc = db.doc('wallets.v1', { defaults: DEFAULT_WALLETS });

/** Upsert by address (case-insensitive) or id; merge fields when matching */
function uniqUpsert(list = [], item) {
  if (!item) return list;
  const addr = item?.address?.toLowerCase?.();
  const id   = item?.id;
  let updated = false;

  const next = (list || []).map((w) => {
    const same =
      (addr && w?.address?.toLowerCase?.() === addr) ||
      (id && w?.id === id);
    if (same) {
      updated = true;
      return { ...w, ...item };
    }
    return w;
  });

  if (!updated) next.push(item);
  return next;
}

export const walletService = {
  /* ------------------ Storage (persistent) ------------------ */
  get() {
    try {
      return walletsDoc.get() || { ...DEFAULT_WALLETS };
    } catch (e) {
      log.warn('walletService.get failed', { message: e?.message });
      return { ...DEFAULT_WALLETS };
    }
  },
  /** Replace fields atomically (not for pushing to arrays) */
  update(patch = {}) {
    try {
      const saved = walletsDoc.patch((cur) => ({ ...cur, ...patch }));
      log.debug('walletService.update ok', { keys: Object.keys(patch) });
      return saved;
    } catch (e) {
      log.warn('walletService.update failed', { message: e?.message });
      return this.get();
    }
  },
  reset() {
    try {

      return walletsDoc.reset();
    } catch (e) {
      log.warn('walletService.reset failed', { message: e?.message });
      return { ...DEFAULT_WALLETS };
    }
  },
  getByChain(chain) {
    const doc = this.get();
    return Array.isArray(doc[chain]) ? doc[chain] : [];
  },

  /** legacy helpers kept (return chain list only) */
  set(chain, wallets = []) {
    return this.update({ [chain]: wallets });
  },

  add(chain, walletMeta) {
    return walletsDoc.patch((cur) => {
      const list = Array.isArray(cur[chain]) ? cur[chain] : [];
      return { ...cur, [chain]: uniqUpsert(list, walletMeta) };
    })[chain];
  },

  remove(chain, predicate) {
    const list = this.getByChain(chain);
    const next = typeof predicate === 'function'
      ? list.filter((w) => !predicate(w))
      : list.filter((w) => w?.address !== predicate && w?.id !== predicate);
    const saved = this.update({ [chain]: next });
    return saved[chain];
  },

  findWallet(addressOrId) {
    const doc = this.get();
    for (const [chain, list] of Object.entries(doc)) {
      if (!Array.isArray(list)) continue;
      const found = list.find((w) => w?.address === addressOrId || w?.id === addressOrId);
      if (found) return { chain, wallet: found };
    }
    return null;
  },

  /* --------------- Instances (runtime, non-persistent) --------------- */
  async _buildInstance(chain, info) {
    const cfg = networkStore.getConfig(chain);
    switch (chain) {
      case WALLET_FAMILY.ETHEREUM:
      case WALLET_FAMILY.BSC:
      case WALLET_FAMILY.POLYGON:
        return walletBuilder.buildEvmWallet({
          privateKey: info.privateKey,
          networkConfig: cfg,
          family: chain,
          index: 0,
        });
      case WALLET_FAMILY.SOLANA:
        return walletBuilder.buildSolanaWallet({
          privateKey: info.privateKey, // or seed32 if factory expects it
          networkConfig: cfg,
          index: 0,
        });
      case WALLET_FAMILY.TRON:
        return walletBuilder.buildTronWallet({
          privateKey: info.privateKey,
          networkConfig: cfg,
          index: 0,
        });
      case WALLET_FAMILY.BITCOIN:
        return walletBuilder.buildBitcoinWallet({
          privateKey: info.privateKey,
          networkConfig: cfg,
          network: cfg?.network,
          index: 0,
        });
      default:
        return null;
    }
  },

  /** Import by mnemonic, persist + build instances, seed per-wallet default tokens */
  async init(mnemonic) {
    const {mnemonic: savedMnemonic, out: derived} = await walletKeyringService.deriveAllChains(mnemonic);

    // 1) Persist addresses/paths
    const saved = walletsDoc.patch((cur) => {
      const next = { ...cur };
      for (const [chain, info] of Object.entries(derived)) {
        const meta = {
          address: info.address,
          path: info.path,
          tag: info.tag,
          createdAt: Date.now(),
        };
        const list = Array.isArray(next[chain]) ? next[chain] : [];
        next[chain] = uniqUpsert(list, meta);
      }
      return next;
    });
    const instances = {};
    // 2) Build instances and cache
    for (const [chain, info] of Object.entries(derived)) {
      try {
        const inst = await this._buildInstance(chain, info);
        if (inst) {
          instances[chain] = inst;
        }
      } catch (e) {
        log.warn('walletService.buildInstance failed', { chain, message: e?.message });
      }
    }
    return { mnemonic: savedMnemonic, saved, instances: { ...instances } };
  },
};
