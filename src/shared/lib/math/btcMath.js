// src/shared/math/btcMath.js

export const ZERO = BigInt(0);
export const SATS_PER_BTC = BigInt(100000000);

// Parse “BTC” string/number to sats (BN)
export function btcToSatsBN(x) {
  const s = String(x).trim();
  if (s.includes('.')) {
    const [i, d = ''] = s.split('.');
    const ds = (d + '00000000').slice(0, 8);
    const intPart = BigInt(i || '0');
    const decPart = BigInt(ds || '0');
    return intPart * SATS_PER_BTC + decPart;
  }
  return BigInt(s) * SATS_PER_BTC;
}

// Convert sats (BN, number, or string) to BTC string
export function satsToBtc(sats) {
  const bn = BigInt(sats);

  const intPart = bn / SATS_PER_BTC;
  const fracPart = bn % SATS_PER_BTC;

  // Pad fractional part to 8 digits
  const fracStr = fracPart.toString().padStart(8, '0');

  // Trim trailing zeros for nicer output, but keep at least 1 digit
  return `${intPart}.${fracStr.replace(/0+$/, '') || '0'}`;
}
