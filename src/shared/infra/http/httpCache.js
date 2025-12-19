function stableStringify(obj) {
  if (obj == null) return "";
  if (typeof obj !== "object") return String(obj);
  const keys = Object.keys(obj).sort();
  const out = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] = (v && typeof v === "object") ? JSON.parse(stableStringify(v)) : v;
  }
  return JSON.stringify(out);
}

function makeKey(url, params) {
  const p = params ? `?${stableStringify(params)}` : "";
  return `${url}${p}`;
}

// In-memory TTL cache (process-local)
const store = new Map(); // key -> { data, expireAt }

function get(url, params) {
  const key = makeKey(url, params);
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    store.delete(key);
    return null;
  }
  return hit.data; // return cached data
}

function set(url, params, data, ttlMs = 15_000) {
  const key = makeKey(url, params);
  store.set(key, { data, expireAt: Date.now() + ttlMs });
}

function del(url, params) {
  const key = makeKey(url, params);
  store.delete(key);
}

function clear() {
  store.clear();
}

// Optional helper if you ever want atomic load-and-cache:
async function getOrSet(url, params, ttlMs, loader) {
  const hit = get(url, params);
  if (hit !== null) return hit;
  const data = await loader();
  set(url, params, data, ttlMs);
  return data;
}

module.exports = {
  get,
  set,
  del,
  clear,
  getOrSet,
  _makeKey: makeKey, // exported for testing if you want
};
