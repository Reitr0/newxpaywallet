import { proxy } from 'valtio';
import log from '@src/shared/infra/log/logService';
import { walletRegistryService } from '@features/wallet/service/walletRegistryService';

export const walletRegistryStore = proxy({
  status: 'idle',
  error: null,
  data: {},

  set(chain, tokens = []) {
    try {
      this.status = 'loading'; this.error = null;
      const out = walletRegistryService.set(chain, tokens) || [];
      this.data[chain] = out;
      this.status = 'ready';
      return out;
    } catch (e) {
      this.status = 'error'; this.error = e?.message;
      log.warn('walletRegistryStore.set failed', { chain, message: e?.message });
      return this.data?.[chain] || [];
    }
  },

  add(chain, tokenMeta) {
    try {
      this.status = 'loading'; this.error = null;
      const out = walletRegistryService.add(chain, tokenMeta) || [];
      this.data[chain] = out;
      this.status = 'ready';
      return out;
    } catch (e) {
      this.status = 'error'; this.error = e?.message;
      log.warn('walletRegistryStore.add failed', { chain, message: e?.message });
      return this.data?.[chain] || [];
    }
  },

  upsertMany(chain, tokens = []) {
    try {
      this.status = 'loading'; this.error = null;
      const out = walletRegistryService.upsertMany(chain, tokens) || [];
      this.data[chain] = out;
      this.status = 'ready';
      return out;
    } catch (e) {
      this.status = 'error'; this.error = e?.message;
      log.warn('walletRegistryStore.upsertMany failed', { chain, message: e?.message });
      return this.data?.[chain] || [];
    }
  },

  remove(chain, tokenAddressOrPredicate) {
    try {
      this.status = 'loading'; this.error = null;
      const out = walletRegistryService.remove(chain, tokenAddressOrPredicate) || [];
      this.data[chain] = out;
      this.status = 'ready';
      return out;
    } catch (e) {
      this.status = 'error'; this.error = e?.message;
      log.warn('walletRegistryStore.remove failed', { chain, message: e?.message });
      return this.data?.[chain] || [];
    }
  },

  reset(chain) {
    try {
      this.status = 'loading'; this.error = null;
      walletRegistryService.reset(chain);
      this.data[chain] = [];
      this.status = 'ready';
      return [];
    } catch (e) {
      this.status = 'error'; this.error = e?.message;
      log.warn('walletRegistryStore.reset failed', { chain, message: e?.message });
      return this.data?.[chain] || [];
    }
  },

  list(chain) {
    try {
      this.status = 'loading'; this.error = null;
      const out = walletRegistryService.seedDefaults(chain) || [];
      this.data[chain] = out;
      this.status = 'ready';
      return out;
    } catch (e) {
      this.status = 'error'; this.error = e?.message;
      log.warn('walletRegistryStore.seedDefaults failed', { chain, message: e?.message });
      return this.data?.[chain] || [];
    }
  },
});
