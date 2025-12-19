// src/features/currency/service/currencyService.js
import { db } from '@src/shared/infra/db/db';
import log from '@src/shared/infra/log/logService';

export const DEFAULT_CURRENCY = {
  v: 1,
  currency: 'USD',            // base fiat reference
  locale: undefined,          // device locale by default
  showCurrencyCode: false,    // "$10.00 USDT"
  compactFiatSecondary: true, // compact fiat under balance rows
  tinyFiatThreshold: 0.01,    // display "< $0.01"
  dustFloorDp: 8,             // display "< 0.00000001"
  cryptoDp: {                 // dynamic crypto precision
    ge1: 4,                   // ≥ 1.0 → 4 dp
    ge001: 6,                 // ≥ 0.01 → 6 dp
    lt001: 8,                 // < 0.01 → 8 dp
  },
  theme: 'system',
  compactNumbers: true,
};

const currencyDoc = db.doc('currency.v1', {
  defaults: DEFAULT_CURRENCY,
});

export const currencyService = {
  get() {
    try {
      return currencyDoc.get();
    } catch (e) {
      log.warn('currencyService.get failed', { message: e?.message });
      return { ...DEFAULT_CURRENCY };
    }
  },

  update(patch = {}) {
    try {
      const saved = currencyDoc.patch((cur) => ({ ...cur, ...patch }));
      log.debug('currencyService.update ok', { keys: Object.keys(patch) });
      return saved;
    } catch (e) {
      log.warn('currencyService.update failed', { message: e?.message });
      return this.get();
    }
  },

  reset() {
    try {
      return currencyDoc.reset();
    } catch (e) {
      log.warn('currencyService.reset failed', { message: e?.message });
      return { ...DEFAULT_CURRENCY };
    }
  },

  setCurrency(currency) {
    return this.update({ currency: String(currency || 'USD') });
  },

  setLocale(locale) {
    return this.update({ locale });
  },

  setCompact(flag) {
    return this.update({ compactNumbers: !!flag });
  },
};
