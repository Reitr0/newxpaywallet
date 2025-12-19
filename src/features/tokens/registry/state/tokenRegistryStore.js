import { proxy } from 'valtio';
import { useSnapshot } from 'valtio/react';
import log from '@src/shared/infra/log/logService';
import { tokenRegistryService } from '@features/tokens/registry/service/tokenRegistryService';

/**
 * tokenRegistryStore
 * - Reactive in-memory mirror of tokenRegistryService.
 * - State shape:
 *   {
 *     data: { [chainKey]: TokenMeta[] },
 *     status: 'idle' | 'loading' | 'ready' | 'error',
 *     error: string|null
 *   }
 */
export const tokenRegistryStore = proxy({
  status: 'idle',
  error: null,
  data: {}, // chainKey -> token list

  /* --------------------------- Load tokens for chain -------------------------- */
  load(chainId) {
    try {
      tokenRegistryStore.status = 'loading';
      const list = tokenRegistryService.list(chainId);
      tokenRegistryStore.data[chainId] = list;
      tokenRegistryStore.status = 'ready';
      tokenRegistryStore.error = null;
      log.info('tokenRegistryStore.load ok', { chainId, count: list.length });
    } catch (e) {
      tokenRegistryStore.status = 'error';
      tokenRegistryStore.error = e?.message || String(e);
      log.warn('tokenRegistryStore.load failed', { chainId, message: e?.message });
    }
  },

  /* --------------------------- Add or upsert token --------------------------- */
  addToken(chainId, token) {
    try {

      tokenRegistryStore.data[chainId] = tokenRegistryService.add(chainId, token);
      log.info('tokenRegistryStore.addToken ok', { chainId, symbol: token.symbol });
    } catch (e) {
      log.warn('tokenRegistryStore.addToken failed', { chainId, message: e?.message });
    }
  },

  /* --------------------------- Remove token ---------------------------------- */
  removeToken(chainId, address) {
    try {

      tokenRegistryStore.data[chainId] = tokenRegistryService.remove(chainId, address);
      log.info('tokenRegistryStore.removeToken ok', { chainId, address });
    } catch (e) {
      log.warn('tokenRegistryStore.removeToken failed', { chainId, message: e?.message });
    }
  },

  /* --------------------------- Reset chain ----------------------------------- */
  reset(chainId) {
    try {

      tokenRegistryStore.data[chainId] = tokenRegistryService.reset(chainId);
      log.info('tokenRegistryStore.reset ok', { chainId });
    } catch (e) {
      log.warn('tokenRegistryStore.reset failed', { chainId, message: e?.message });
    }
  },

  /* --------------------------- Find helpers ---------------------------------- */
  findByAddress(chainId, address) {
    return tokenRegistryService.findByAddress(chainId, address);
  },
  findBySymbol(chainId, symbol) {
    return tokenRegistryService.findBySymbol(chainId, symbol);
  },

  /* --------------------------- Load all chains ------------------------------- */
  loadAll() {
    try {
      tokenRegistryStore.status = 'loading';
      const out = {};
      for (const chainKey of tokenRegistryService.chains()) {
        out[chainKey] = tokenRegistryService.list(chainKey);
      }
      tokenRegistryStore.data = out;
      tokenRegistryStore.status = 'ready';
    } catch (e) {
      tokenRegistryStore.status = 'error';
      tokenRegistryStore.error = e?.message || String(e);
      log.warn('tokenRegistryStore.loadAll failed', { message: e?.message });
    }
  },
});

/* --------------------------- React hook shortcut ---------------------------- */
export function useTokenRegistry() {
  return useSnapshot(tokenRegistryStore);
}
