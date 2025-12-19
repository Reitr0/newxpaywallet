/** -------------------- Constants -------------------- */
const PLAN_ORDER = [
  'btc', 'eth', 'bsc', 'polygon', 'sol', 'tron',
  'eth-usdt', 'eth-usdc', 'eth-dai',
  'bsc-usdt', 'bsc-busd',
  'polygon-usdc', 'polygon-usdt',
];

const PLAN_RANK = Object.fromEntries(PLAN_ORDER.map((k, i) => [k, i]));

/** -------------------- Accessors -------------------- */
function getSymbol(item) {
  return item?.meta?.symbol ?? item?.label ?? item?.key ?? '';
}

function getBalance(item) {
  const v = item?.balance?.balance;
  return Number.isFinite(Number(v)) ? Number(v) : NaN;
}

function getPrice(item) {
  return Number.isFinite(item?.price) ? item.price : NaN;
}

function getChange24h(item) {
  return Number.isFinite(item?.change24h) ? item.change24h : NaN;
}

function getPlanRank(item) {
  return PLAN_RANK[item?.key] ?? 1e9;
}

/** -------------------- Sorting -------------------- */
function makeComparator(sortBy = 'plan', sortDir = 'asc') {
  const dir = sortDir === 'desc' ? -1 : 1;

  return (a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'symbol':
        cmp = getSymbol(a).localeCompare(getSymbol(b));
        break;
      case 'balance':
        cmp = getBalance(a) - getBalance(b);
        break;
      case 'price':
        cmp = getPrice(a) - getPrice(b);
        break;
      case 'change24h':
        cmp = getChange24h(a) - getChange24h(b);
        break;
      case 'plan':
      default:
        cmp = getPlanRank(a) - getPlanRank(b);
    }
    if (cmp !== 0) return cmp * dir;
    return getPlanRank(a) - getPlanRank(b);
  };
}

function sortWallets(list = [], sortBy = 'plan', sortDir = 'asc') {
  return [...list].sort(makeComparator(sortBy, sortDir));
}

/** -------------------- Unified Utility Export -------------------- */
export const walletUtil = {
  PLAN_ORDER,
  PLAN_RANK,
  getSymbol,
  getBalance,
  getPrice,
  getChange24h,
  getPlanRank,
  makeComparator,
  sortWallets,
};
