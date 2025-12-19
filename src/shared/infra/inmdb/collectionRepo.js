import logService from '@src/shared/infra/log/logService';

/**
 * @template T
 * @param {Object} cfg
 * @param {import('../kvAdapter').KVAdapter} cfg.adapter
 * @param {string} cfg.ns              // e.g. "wallets"
 * @param {(raw:any)=>T|null} cfg.decode
 * @param {(val:T)=>any} [cfg.encode]
 * @param {(doc:T)=>string} cfg.getId
 */
export function createCollectionRepo({ adapter, ns, decode, encode=(v)=>v, getId }) {
  const log = logService.ns(`repo:${ns}`);
  const KEY = {
    index: `${ns}:__index`,
    item: (id) => `${ns}:item:${id}`,
  };

  const readIds = () => Array.isArray(adapter.get(KEY.index)) ? adapter.get(KEY.index) : [];
  const writeIds = (ids) => adapter.set(KEY.index, Array.from(new Set(ids)));

  function get(id){
    const raw = adapter.get(KEY.item(id));
    const doc = decode(raw);
    log.debug("get", { id, hit: !!doc });
    return doc;
  }

  return {
    get,
    listIds(){ const ids = readIds(); log.debug("listIds", { count: ids.length }); return ids; },
    list(){ const ids = readIds(); return ids.map(get).filter(Boolean); },

    put(doc){
      const id = getId(doc);
      const enc = encode(doc);
      adapter.set(KEY.item(id), enc);
      const ids = readIds();
      if (!ids.includes(id)) writeIds([...ids, id]);
      log.debug("put", { id });
      return doc;
    },

    update(id, mutate){
      const cur = get(id);
      const next = mutate(cur);
      const ok = decode(next);
      if (!ok) throw new Error(`Invalid entity after update id=${id}`);
      adapter.set(KEY.item(id), encode(ok));
      log.debug("update", { id });
      return ok;
    },

    delete(id){
      adapter.remove(KEY.item(id));
      writeIds(readIds().filter(x=>x!==id));
      log.debug("delete", { id });
    },

    clear(){
      const ids = readIds();
      for (const id of ids) adapter.remove(KEY.item(id));
      writeIds([]);
      log.info("clear");
    },

    /** optional helpers */
    contains(id){ return adapter.contains?.(KEY.item(id)) ?? !!get(id); },
    keys(){ return adapter.keys?.(`${ns}:item:`) ?? []; },
  };
}
