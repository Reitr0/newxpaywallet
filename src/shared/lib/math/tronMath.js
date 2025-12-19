// src/shared/math/tronMath.js

/** ----------
 * tiny bigint unit helpers (no floating math)
 * ---------- */
export const ZERO = BigInt(0);
export const ONE_TRX = BigInt(1_000_000); // Sun per TRX
const TEN = BigInt(10);

export const parseUnits = (v, d) => {
  const s = String(v ?? '0').trim();
  const dec = Number(d || 0);
  if (!s.includes('.')) return BigInt(s) * (TEN ** BigInt(dec));
  const [i, f = ''] = s.split('.');
  const frac = (f + '0'.repeat(dec)).slice(0, dec);
  return BigInt(i || '0') * (TEN ** BigInt(dec)) + BigInt(frac || '0');
};

export const formatUnits = (amt, d) => {
  const dec = Number(d || 0);
  if (dec === 0) return BigInt(amt).toString(10);
  const base = TEN ** BigInt(dec);
  const a = BigInt(amt);
  const i = (a / base).toString(10);
  const r = (a % base).toString(10).padStart(dec, '0').replace(/0+$/, '');
  return r ? `${i}.${r}` : i;
};

export const toSun   = (trx) => parseUnits(trx, 6);
export const fromSun = (sun) => formatUnits(sun, 6);

/** percent → basis points floor (e.g. "0.2" => 20 bps) */
export const percentOf = (amount, percent) => {
  const bps = Math.floor(Number(percent || 0) * 100);
  return (BigInt(amount) * BigInt(bps)) / BigInt(10000);
};


/** Internal helpers (bigint-safe) */
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const toBigIntSafe = (x) => {
  try {
    if (typeof x === 'bigint') return x;
    if (typeof x === 'number') return BigInt(Math.trunc(x));
    if (typeof x === 'string') {
      if (x.startsWith('0x') || x.startsWith('0X')) return BigInt(x);
      return BigInt(x);
    }
  } catch {}
  return ZERO;
};


export const toBigIntHex = (hexLike) => {
  if (hexLike == null) return ZERO;
  const s = String(hexLike).trim();
  if (s === '' || s === '0x' || s === '0X') return ZERO;
  return BigInt(s.startsWith('0x') || s.startsWith('0X') ? s : `0x${s}`);
};
