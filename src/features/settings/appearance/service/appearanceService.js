// src/features/appearance/service/appearanceService.js
import { Appearance } from 'react-native';
import { db } from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

export const DEFAULT_APPEARANCE = {
  v: 1,
  theme: 'default',     // app theme skin (e.g., default, holiday, etc.)
  colorScheme: 'light', // 'light' | 'dark'
  useSystem: true,      // follow OS setting
};

const appearanceDoc = db.doc('appearance.v1', {
  defaults: DEFAULT_APPEARANCE,
  decode: (raw) => ({ ...DEFAULT_APPEARANCE, ...(raw || {}) }),
  encode: (val) => val,
});

export const appearanceService = {
  /** Read current appearance settings (sanitized) */
  get() {
    try {
      return appearanceDoc.get();
    } catch (e) {
      log.warn('appearance.get failed', { message: e?.message });
      return { ...DEFAULT_APPEARANCE };
    }
  },

  /** Patch & persist */
  update(patch = {}) {
    try {

      return appearanceDoc.patch((cur) => ({ ...cur, ...patch }));
    } catch (e) {
      log.warn('appearance.update failed', { message: e?.message });
      return this.get();
    }
  },

  /** Reset to defaults */
  reset() {
    try {
      return appearanceDoc.reset();
    } catch (e) {
      log.warn('appearance.reset failed', { message: e?.message });
      return { ...DEFAULT_APPEARANCE };
    }
  },

  /** One-time init: if useSystem, sync colorScheme with OS */
  initFromSystem() {
    try {
      const cur = this.get();
      if (cur.useSystem) {
        const sys = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
        return this.update({ colorScheme: sys });
      }
      return cur;
    } catch (e) {
      log.warn('appearance.initFromSystem failed', { message: e?.message });
      return this.get();
    }
  },

  /** Setters (tiny helpers) */
  setTheme(theme) {
    return this.update({ theme: String(theme || 'default') });
  },
  setColorScheme(colorScheme) {
    const cs = colorScheme === 'dark' ? 'dark' : 'light';
    return this.update({ colorScheme: cs, useSystem: false });
  },
  setUseSystem(flag) {
    const useSystem = !!flag;
    if (useSystem) {
      const sys = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
      return this.update({ useSystem, colorScheme: sys });
    }
    return this.update({ useSystem });
  },
};
