// src/features/network/state/networkStore.js
import { proxy, subscribe } from 'valtio';
import { useSnapshot } from 'valtio/react';
import log from '@src/shared/infra/log/logService';
import { DEFAULTS_NETWORKS, networkService } from '@src/features/network/service/networkService';

const persisted = networkService.get();

export const networkStore = proxy({
  // static catalog
  catalog: DEFAULTS_NETWORKS,

  // selected envs
  envs: persisted.envs,

  // actions
  setEnv(family, envKey) {
    const saved = networkService.setEnv(family, envKey);
    Object.assign(networkStore, saved);
  },

  setMany(envMap) {
    const saved = networkService.setManyEnvs(envMap);
    Object.assign(networkStore, saved);
  },

  reset() {
    const saved = networkService.reset();
    Object.assign(networkStore, saved);
  },

  // selectors
  getEnv(family) {
    return networkService.getEnv(family);
  },

  getConfig(family) {
    return networkService.getCurrentConfig(family);
  },

  getAllConfigs() {
    return networkService.getAllCurrentConfigs();
  },

  explorerTxUrl(family, txid) {
    return networkService.getExplorerTxUrl(family, txid);
  },

  explorerAddressUrl(family, address) {
    return networkService.getExplorerAddressUrl(family, address);
  },
});

/** auto-persist envs only */
subscribe(networkStore, () => {
  try {
    networkService.update({ envs: networkStore.envs });
  } catch (e) {
    log.warn('networkStore persist failed', { message: e?.message });
  }
});

/** React hook */
export function useNetworks() {
  return useSnapshot(networkStore);
}
