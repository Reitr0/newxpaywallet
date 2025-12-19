// src/shared/infra/storage/repository/ttlDbCache.js
const now = () => Math.floor(Date.now()/1000);

/**
 * Adds TTL behavior for arbitrary string keys (not collection IDs)
 * Keys stored as `${ns}:cache:${key}`
 */
export function createTTLCache({ adapter, ns, defaultTtlSec = 30 }){
  const keyOf = (k) => `${ns}:cache:${k}`;
  return {
    set(key, value, ttlSec = defaultTtlSec){
      adapter.set(keyOf(key), { value, expire: now() + ttlSec });
    },
    get(key){
      const rec = adapter.get(keyOf(key));
      if (!rec) return null;
      if (rec.expire < now()) { adapter.remove(keyOf(key)); return null; }
      return rec.value;
    },
    del(key){ adapter.remove(keyOf(key)); },
    clear(){
      const pref = `${ns}:cache:`;
      const ks = adapter.keys?.(pref) || [];
      ks.forEach(k => adapter.remove(k));
    }
  };
}
