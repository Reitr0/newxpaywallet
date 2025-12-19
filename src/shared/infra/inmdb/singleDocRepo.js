import logService from '@src/shared/infra/log/logService';

/**
 * @template T
 * @param {Object} cfg
 * @param {import('../kvAdapter').KVAdapter} cfg.adapter
 * @param {string} cfg.key                 // fixed key, e.g., "settings"
 * @param {(raw:any)=>T|null} cfg.decode   // sanitize/validate on read
 * @param {(val:T)=>any} [cfg.encode]      // default passthrough
 * @param {T} cfg.defaults                 // fallback when missing/invalid
 */
export function createSingleDocRepo({ adapter, key, decode, encode = (v)=>v, defaults }) {
  const log = logService.ns(`repo:${key}`);
  const getRaw = () => adapter.get(key);

  return {
    get(){
      const raw = getRaw();
      const doc = decode(raw) || defaults;
      log.debug("get", { has: !!raw });
      return doc;
    },
    set(next){
      const enc = encode(next);
      adapter.set(key, enc);
      log.debug("set");
      return next;
    },
    patch(mutator){
      const cur = this.get();
      const next = mutator(cur);
      if (decode(next) == null) throw new Error(`Invalid doc for ${key}`);
      return this.set(next);
    },
    exists(){ return adapter.contains?.(key) ?? (getRaw() != null); },
    reset(){ adapter.remove(key); log.info("reset"); },
    subscribe(listener){
      if (!adapter.subscribe) return () => {};
      return adapter.subscribe((changed) => { if (changed === key) listener(this.get()); });
    }
  };
}
