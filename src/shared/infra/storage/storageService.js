// src/shared/storage/mmkvStorage.js
import { MMKV } from 'react-native-mmkv';
import logService from '@src/shared/infra/log/logService'; // adjust path if needed


function safeJSONParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

function redactKey(k) {
  // keep keys visible but short; never log values
  return String(k).slice(0, 120);
}

/**
 * Factory: create a storage instance by id
 * - Logs all operations at debug level (keys only, never values)
 * - Catches & logs errors at warn level
 */
export const createMMKV = (id = "app-storage") => {
  const instance = new MMKV({ id });

  logService.info("initialized");

  return {
    /**
     * Set a key to a value.
     * Objects are JSON-stringified; everything else coerced to string.
     */
    setItem: (key, value) => {
      const k = redactKey(key);
      try {
        const stringValue =
          typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value);

        instance.set(key, stringValue);
        logService.debug("setItem ok", { key: k, bytes: stringValue.length });
      } catch (e) {
        logService.warn("setItem error", { key: k, message: e?.message });
      }
    },

    /**
     * Get a key (returns parsed JSON if possible; otherwise raw string).
     * `fallback` is returned when key missing or parse fails to a falsy/null.
     */
    getItem: (key, fallback = null) => {
      const k = redactKey(key);
      try {
        const s = instance.getString(key);
        if (s == null) {
          logService.debug("getItem miss", { key: k });
          return fallback;
        }
        const parsed = safeJSONParse(s);
        logService.debug("getItem hit", { key: k });
        return parsed ?? fallback;
      } catch (e) {
        logService.warn("getItem error", { key: k, message: e?.message });
        return fallback;
      }
    },

    /**
     * Remove a key.
     */
    removeItem: (key) => {
      const k = redactKey(key);
      try {
        instance.delete(key);
        logService.debug("removeItem ok", { key: k });
      } catch (e) {
        logService.warn("removeItem error", { key: k, message: e?.message });
      }
    },

    /**
     * Clear all keys in this MMKV instance.
     * Be careful — this is destructive.
     */
    clearAll: () => {
      try {
        const count = instance.getAllKeys().length;
        instance.clearAll();
        logService.info("clearAll ok", { count });
      } catch (e) {
        logService.warn("clearAll error", { message: e?.message });
      }
    },

    /**
     * Utility helpers (handy across the app)
     */
    keys: (prefix = "") => {
      try {
        const list = instance.getAllKeys().filter((k) => k.startsWith(prefix));
        logService.debug("keys", { prefix: redactKey(prefix), count: list.length });
        return list;
      } catch (e) {
        logService.warn("keys error", { prefix: redactKey(prefix), message: e?.message });
        return [];
      }
    },

    contains: (key) => {
      try {
        const has = instance.contains(key);
        logService.debug("contains", { key: redactKey(key), has });
        return has;
      } catch (e) {
        logService.warn("contains error", { key: redactKey(key), message: e?.message });
        return false;
      }
    },
  };
};

// Default global storage (same as before)
export const defaultStorage = createMMKV("app-storage");
