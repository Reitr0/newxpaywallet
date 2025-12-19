import { createMMKV } from '@src/shared/infra/storage/storageService';

/**
 * MMKV → KVAdapter with a namespace prefix
 * @returns {import('./kvAdapter').KVAdapter}
 */
export function createMMKVAdapter(namespace = "app") {
  const kv = createMMKV(namespace);
  const prefix = `${namespace}:`;
  const K = (k) => `${prefix}${k}`;

  return {
    getItem(key){ return kv.getItem(K(key), null); },
    setItem(key, value){ kv.setItem(K(key), value); },
    removeItem(key){ kv.removeItem(K(key)); },
    clearAll(){
      kv.keys(prefix).forEach((k) => kv.removeItem(k));
    },
    keys(pref = ""){
      const p = `${prefix}${pref}`;
      return kv.keys(p).map(k => k.slice(prefix.length));
    },
    contains(key){ return kv.contains(K(key)); },
    subscribe(listener){
      if (!kv.subscribe) return () => {};
      return kv.subscribe((changedKey) => {
        if (changedKey?.startsWith(prefix)) {
          const k = changedKey.slice(prefix.length);
          listener(k);
        }
      });
    }
  };
}
