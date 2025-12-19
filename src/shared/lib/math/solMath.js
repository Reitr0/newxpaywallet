// src/shared/math/solMath.js

// ------- unit helpers (no floating math) -------
export const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
export const ZERO = BigInt(0);

export const toLamports = (sol) => {
  // accepts number|string
  const s = String(sol ?? '0').trim();
  if (!s.includes('.')) return BigInt(s) * LAMPORTS_PER_SOL;
  const [i, d = ''] = s.split('.');
  const frac = (d + '0'.repeat(9)).slice(0, 9);
  return BigInt(i || '0') * LAMPORTS_PER_SOL + BigInt(frac || '0');
};

export const fromLamports = (lam) => {
  const neg = lam < ZERO;
  const x = neg ? -lam : lam;
  const i = (x / LAMPORTS_PER_SOL).toString(10);
  const r = (x % LAMPORTS_PER_SOL).toString(10).padStart(9, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + (r ? `${i}.${r}` : i);
};

// token units (BN-free, bigint math)
const TEN = BigInt(10);

export const parseUnits = (value, decimals) => {
  const s = String(value ?? '0').trim();
  const d = Number(decimals || 0);
  if (!s.includes('.')) return BigInt(s) * (TEN ** BigInt(d));
  const [i, f = ''] = s.split('.');
  const frac = (f + '0'.repeat(d)).slice(0, d);
  return BigInt(i || '0') * (TEN ** BigInt(d)) + BigInt(frac || '0');
};

export const formatUnits = (amount, decimals) => {
  const d = Number(decimals || 0);
  if (d === 0) return amount.toString(10);
  const base = TEN ** BigInt(d);
  const i = (amount / base).toString(10);
  const r = (amount % base).toString(10).padStart(d, '0').replace(/0+$/, '');
  return r ? `${i}.${r}` : i;
};

// percent in basis points (floor)
export const percentOf = (amount, percent) => {
  const bps = Math.floor(Number(percent || 0) * 100); // 0.2 -> 20 bps
  return (amount * BigInt(bps)) / BigInt(10000);
};
