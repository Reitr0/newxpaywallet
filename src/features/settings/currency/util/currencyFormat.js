// src/features/currency/lib/currencyFormat.js

/** Cache Intl.NumberFormat by a stable key */
const fmtCache = new Map();

function getFiatFmt(locale, currency, code, notation, maxFD, minFD) {
    const key = `${locale || ''}|${currency}|${code}|${notation}|${maxFD}|${minFD}`;
    let fmt = fmtCache.get(key);
    if (!fmt) {
        fmt = new Intl.NumberFormat(locale || undefined, {
            style: 'currency',
            currency,
            currencyDisplay: code,
            notation,
            maximumFractionDigits: maxFD,
            minimumFractionDigits: minFD,
        });
        fmtCache.set(key, fmt);
    }
    return fmt;
}

/**
 * Format a fiat value using settings + optional overrides
 */
export function formatFiat(value, settings, overrides = {}) {
    const num = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(num)) return '—';

    const {
        currency = 'USD',
        locale,
        showCurrencyCode = false,
        compactNumbers = false,
        tinyFiatThreshold = 0.01,
    } = settings;

    const effShowCode =
        typeof overrides.showCurrencyCode === 'boolean'
            ? overrides.showCurrencyCode
            : showCurrencyCode;

    const effCompact =
        typeof overrides.compactNumbers === 'boolean'
            ? overrides.compactNumbers
            : compactNumbers;

    const maxFD =
        typeof overrides.maxFractionDigits === 'number'
            ? overrides.maxFractionDigits
            : 2;

    const minFD =
        typeof overrides.minFractionDigits === 'number'
            ? overrides.minFractionDigits
            : 0;

    const abs = Math.abs(num);

    // Handle small-but-nonzero values
    if (abs > 0 && abs < (tinyFiatThreshold || 0)) {
        const tinyFmt = getFiatFmt(
            locale,
            currency,
            effShowCode ? 'code' : 'symbol',
            'standard',
            Math.max(2, maxFD),
            2
        );
        const tinyTxt = tinyFmt.format(tinyFiatThreshold);
        return num < 0 ? `-< ${tinyTxt}` : `< ${tinyTxt}`;
    }

    const fmt = getFiatFmt(
        locale,
        currency,
        effShowCode ? 'code' : 'symbol',
        effCompact ? 'compact' : 'standard',
        maxFD,
        minFD
    );
    return fmt.format(num);
}

/**
 * Decide crypto decimal places from settings.cryptoDp and a numeric amount
 */
export function cryptoDpForAmount(amountNum, cryptoDp) {
    if (!Number.isFinite(amountNum)) return 0;
    if (amountNum >= 1) return cryptoDp.ge1;
    if (amountNum >= 0.01) return cryptoDp.ge001;
    return cryptoDp.lt001;
}

/**
 * Format crypto with dynamic dp + trimming zeros
 */
export function formatCrypto(value, settings, opts = {}) {
    const num = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(num)) return '0';

    const dp =
        typeof opts.fixedDp === 'number'
            ? opts.fixedDp
            : cryptoDpForAmount(Math.abs(num), settings.cryptoDp);

    const s = num.toFixed(dp);
    if (!opts.trim) return s;

    // Trim trailing zeros but keep integer
    return s
        .replace(/(\.\d*?[1-9])0+$/, '$1')
        .replace(/\.0+$/, '');
}

/**
 * Format percent (e.g., -1.25 → "-1.25%")
 */
export function formatPercent(pct, locale) {
    const num = typeof pct === 'string' ? Number(pct) : pct;
    if (!Number.isFinite(num)) return '—';
    return new Intl.NumberFormat(locale || undefined, {
        style: 'percent',
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    }).format(num / 100);
}
/**
 * formatCompactNumber
 * -------------------
 * Locale-aware compact notation formatter.
 *
 * Example:
 *   formatCompactNumber(1234)            → "1.2K"
 *   formatCompactNumber(1234567, { locale: 'de-DE' }) → "1,2 Mio."
 *
 * @param {number|string} value
 * @param {object} opts
 * @param {string} [opts.locale] - e.g. 'en-US'
 * @param {number} [opts.maximumFractionDigits=1] - fractional precision
 * @returns {string}
 */
export function formatCompactNumber(value, opts = {}) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';

  const {
    locale = undefined,
    maximumFractionDigits = 1,
    minimumFractionDigits = 0,
  } = opts;

  try {
    const nf = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits,
      maximumFractionDigits,
    });
    return nf.format(num);
  } catch (e) {
    console.warn('[formatCompactNumber] fallback:', e?.message);
    // simple fallback: divide by thousand units
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(maximumFractionDigits)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(maximumFractionDigits)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(maximumFractionDigits)}K`;
    return String(roundTo(num, maximumFractionDigits));
  }
}

/** simple rounding helper */
function roundTo(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
/** Round to 2 decimals, useful for totals */
export function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
