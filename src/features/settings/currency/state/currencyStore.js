// src/features/currency/state/currencyStore.js
import { proxy } from 'valtio';
import { useSnapshot } from 'valtio/react';
import { currencyService } from '@features/settings/currency/service/currencyService';

const persisted = currencyService.get();

export const currencyStore = proxy({
  // state
  currency: persisted.currency,
  locale: persisted.locale,
  showCurrencyCode: persisted.showCurrencyCode,
  compactFiatSecondary: persisted.compactFiatSecondary,
  tinyFiatThreshold: persisted.tinyFiatThreshold,
  dustFloorDp: persisted.dustFloorDp,
  cryptoDp: persisted.cryptoDp,
  theme: persisted.theme,
  compactNumbers: persisted.compactNumbers,

  // actions
  setCurrency(code) {
    const saved = currencyService.setCurrency(code);
    Object.assign(currencyStore, saved);
  },
  setLocale(locale) {
    const saved = currencyService.setLocale(locale);
    Object.assign(currencyStore, saved);
  },
  toggleCompact() {
    const next = !currencyStore.compactNumbers;
    const saved = currencyService.update({ compactNumbers: next });
    Object.assign(currencyStore, saved);
  },

  // NEW: add the rest so UI can control them
  setShowCurrencyCode(flag) {
    const saved = currencyService.update({ showCurrencyCode: !!flag });
    Object.assign(currencyStore, saved);
  },
  setCompactFiatSecondary(flag) {
    const saved = currencyService.update({ compactFiatSecondary: !!flag });
    Object.assign(currencyStore, saved);
  },
  setTinyFiatThreshold(value) {
    const v = Number(value);
    const saved = currencyService.update({ tinyFiatThreshold: isNaN(v) ? 0 : v });
    Object.assign(currencyStore, saved);
  },
  setDustFloorDp(dp) {
    const n = Math.max(0, Math.min(8, Number(dp) || 0));
    const saved = currencyService.update({ dustFloorDp: n });
    Object.assign(currencyStore, saved);
  },
  setCryptoDp(dp) {
    const n = Math.max(0, Math.min(12, Number(dp) || 0));
    const saved = currencyService.update({ cryptoDp: n });
    Object.assign(currencyStore, saved);
  },

  reset() {
    const saved = currencyService.reset();
    Object.assign(currencyStore, saved);
  },
});

/** React hook */
export function useCurrency() {
  return useSnapshot(currencyStore);
}
