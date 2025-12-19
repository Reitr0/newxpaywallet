// src/shared/infra/locale/localeService.js
import { db } from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

export const DEFAULT_LOCALE = {
  v: 1,
  language: 'en',  // default app language
  locale: undefined, // device locale fallback
  rtl: false,       // is Right-To-Left layout
};

const localeDoc = db.doc('locale.v1', {
  defaults: DEFAULT_LOCALE,
});

export const localeService = {
  /** Get current locale settings (safe fallback) */
  get() {
    try {
      return localeDoc.get();
    } catch (e) {
      log.warn('localeService.get failed', { message: e?.message });
      return { ...DEFAULT_LOCALE };
    }
  },

  /** Update specific locale fields */
  update(patch = {}) {
    try {
      const saved = localeDoc.patch((cur) => ({ ...cur, ...patch }));
      log.debug('localeService.update ok', { keys: Object.keys(patch) });
      return saved;
    } catch (e) {
      log.warn('localeService.update failed', { message: e?.message });
      return this.get();
    }
  },

  /** Reset locale settings to defaults */
  reset() {
    try {
      return localeDoc.reset();
    } catch (e) {
      log.warn('localeService.reset failed', { message: e?.message });
      return { ...DEFAULT_LOCALE };
    }
  },

  /** Set language key (e.g. 'en', 'vi', 'zh') */
  setLanguage(language) {
    return this.update({ language: String(language || 'en') });
  },

  /** Set locale (e.g. 'en-US', 'vi-VN') */
  setLocale(locale) {
    return this.update({ locale });
  },

  /** Set Right-To-Left layout mode */
  setRTL(isRTL) {
    return this.update({ rtl: !!isRTL });
  },
};
