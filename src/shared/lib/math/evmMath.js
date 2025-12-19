// utils/evmMaths.js
import { formatUnits, parseUnits } from 'ethers';

// common constants (all bigint)
export const ZERO = BigInt(0);
export const ONE_GWEI = BigInt(1_000_000_000); // 1 gwei = 1e9 wei

/**
 * Convert wei (bigint|string|number) to ETH (string)
 */
export function weiToEth(value) {
  return formatUnits(`${value}`, 18);
}

/**
 * Convert wei to any unit (string)
 */
export function weiToUnit(value, unit) {
  return formatUnits(`${value}`, unit);
}

/**
 * Convert unit back to wei (bigint)
 */
export function unitToWei(value, unit) {
  return parseUnits(`${value}`, unit); // returns bigint in v6
}

/**
 * Convert ETH to wei (bigint)
 */
export function etherToWei(value) {
  return parseUnits(`${value}`, 18); // returns bigint in v6
}

/**
 * Percent of (amount * percent / 100) as bigint
 * @param {bigint|number|string} amount
 * @param {number|string} percent e.g. 2.5 means 2.5%
 * @param {number} precision decimal places for percent (default=4, basis points)
 */
export function percentOf(amount, percent, precision = 4) {
  const amt = BigInt(amount);
  const scaledPercent = parseUnits(percent.toString(), precision); // bigint
  const denom = BigInt(100) * ( BigInt(10) ** BigInt(precision));
  return (amt * scaledPercent) / denom; // floor division
}
