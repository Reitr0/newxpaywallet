// src/features/appearance/state/appearanceStore.js
import { proxy, subscribe } from 'valtio';
import { useSnapshot } from 'valtio/react';
import { Appearance } from 'react-native';
import log from '@src/shared/infra/log/logService';
import { appearanceService } from '@features/settings/appearance/service/appearanceService';

const persisted = appearanceService.get();

export const appearanceStore = proxy({
  // state
  theme: persisted.theme,
  colorScheme: persisted.colorScheme, // 'light' | 'dark'
  useSystem: persisted.useSystem,

  // actions
  init() {
    const saved = appearanceService.initFromSystem();
    Object.assign(appearanceStore, saved);
  },

  setTheme(theme) {
    const saved = appearanceService.setTheme(theme);
    Object.assign(appearanceStore, saved);
  },

  setColorScheme(colorScheme) {
    const saved = appearanceService.setColorScheme(colorScheme);
    Object.assign(appearanceStore, saved);
    try {
      // reflect to RN Appearance only if you force a scheme
      if (!appearanceStore.useSystem && Appearance?.setColorScheme) {
        Appearance.setColorScheme(appearanceStore.colorScheme);
      }
    } catch {}
  },

  setUseSystem(flag) {
    const saved = appearanceService.setUseSystem(flag);
    Object.assign(appearanceStore, saved);
    try {
      if (appearanceStore.useSystem && Appearance?.setColorScheme) {
        // follow OS immediately
        const sys = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
        Appearance.setColorScheme(sys);
      }
    } catch {}
  },

  toggleScheme() {
    const next = appearanceStore.colorScheme === 'dark' ? 'light' : 'dark';
    appearanceStore.setColorScheme(next);
    appearanceStore.setUseSystem(false);
  },

  reset() {
    const saved = appearanceService.reset();
    Object.assign(appearanceStore, saved);
  },
});

/** auto-persist */
subscribe(appearanceStore, () => {
  try {
    appearanceService.update({
      theme: appearanceStore.theme,
      colorScheme: appearanceStore.colorScheme,
      useSystem: appearanceStore.useSystem,
    });
  } catch (e) {
    log.warn('appearance persist failed', { message: e?.message });
  }
});

/** tiny hook */
export function useAppearance() {
  return useSnapshot(appearanceStore);
}
