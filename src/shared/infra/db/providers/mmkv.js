// src/shared/data/db/mmkv.js
import { createMMKVAdapter } from '@src/shared/infra/storage/storageAdapter';
import log from '@src/shared/infra/log/logService';

/**
 * Single MMKV namespace for all document-ish data.
 * Keep business logic in services; this is a tiny persistence layer.
 */
const mmkv = createMMKVAdapter('app-db');

export const mmkvDB = {
  /**
   * doc(key, { defaults, decode, encode })
   * Returns a tiny single-doc API: get/set/patch/reset
   */
  doc(key, { defaults = {}, decode = (x) => x, encode = (x) => x } = {}) {
    const k = String(key);

    return {
      /** Read (decoded + defaulted) */
      get() {
        let raw = null;
        try {
          raw = mmkv.getItem(k); // could already be parsed
        } catch (e) {
          log.warn('[mmkvDB] getItem failed', { key: k, message: e?.message });
        }

        let parsed = raw;
        // only parse if it's a string that looks like JSON
        if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            log.warn('[mmkvDB] JSON parse failed', { key: k, rawPreview: raw.slice(0, 120) });
          }
        }

        try {
          const decoded = decode(parsed);
          return decoded ?? { ...defaults };
        } catch (e) {
          log.warn('[mmkvDB] decode failed; returning defaults', { key: k, message: e?.message });
          return { ...defaults };
        }
      },

      /** Replace whole doc */
      set(val) {
        try {
          const enc = encode(val);
          const json = JSON.stringify(enc);
          if (json == null) {
            log.error('[mmkvDB] encode produced null JSON', { key: k });
            throw new Error(`[mmkvDB] failed to serialize doc for key=${k}`);
          }
          mmkv.setItem(k, json);
          return this.get();
        } catch (e) {
          log.error('[mmkvDB] set failed', { key: k, message: e?.message });
          throw e;
        }
      },

      /** Patch current doc */
      patch(updater) {
        try {
          const cur = this.get();
          const next =
            typeof updater === 'function'
              ? updater(cur)
              : { ...cur, ...(updater || {}) };
          return this.set(next);
        } catch (e) {
          log.error('[mmkvDB] patch failed', { key: k, message: e?.message });
          throw e;
        }
      },

      /** Reset to defaults */
      reset() {
        try {
          if (defaults == null) {
            mmkv.removeItem(k);
            return null;
          }
          return this.set({ ...defaults });
        } catch (e) {
          log.warn('[mmkvDB] reset failed', { key: k, message: e?.message });
          return { ...defaults };
        }
      },
    };
  },

  /** MMKV has no tables — keep API parity with sqliteDB.table */
  table() {
    const msg = '[mmkvDB] No table support. Use sqliteDB.table(name).';
    log.error(msg);
    throw new Error(msg);
  },

  /** Nuke **all** MMKV keys in this namespace */
  clearAll() {
    try {
      mmkv.clearAll();
      log.info('[mmkvDB] clearAll ok');
    } catch (e) {
      log.warn('[mmkvDB] clearAll failed', { message: e?.message });
    }
  },
};
