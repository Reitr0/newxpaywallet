// src/shared/utils/timerUtil.js

export function now() {
  return globalThis.performance?.now ? performance.now() : Date.now();
}

/**
 * Wrap a function and measure its execution duration.
 *
 * @param {string} label - Name for logging (e.g. "vault.getEvmPrivateKey")
 * @param {Function} fn - Function to execute (sync or async)
 * @param  {...any} args - Arguments to pass into fn
 * @returns {Promise<{result:any, duration:number}>} - The fn result + duration in seconds
 */
export async function timed(label, fn, ...args) {
  const t0 = now();
  try {
    const result = await fn(...args);
    const t1 = now();
    const duration = (t1 - t0) / 1000;
    console.log(`[perf] ${label} took ${duration.toFixed(3)}s`);
    return { result, duration };
  } catch (err) {
    const t1 = now();
    const duration = (t1 - t0) / 1000;
    console.error(`[perf] ${label} failed after ${duration.toFixed(3)}s`, err);
    throw err;
  }
}

/**
 * Variant for sync functions only.
 */
export function timedSync(label, fn, ...args) {
  const t0 = now();
  try {
    const result = fn(...args);
    const t1 = now();
    const duration = (t1 - t0) / 1000;
    console.log(`[perf] ${label} took ${duration.toFixed(3)}s`);
    return { result, duration };
  } catch (err) {
    const t1 = now();
    const duration = (t1 - t0) / 1000;
    console.error(`[perf] ${label} failed after ${duration.toFixed(3)}s`, err);
    throw err;
  }
}


/**
 * Wait for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
