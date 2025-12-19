// src/features/swap/adapter/zeroExAdapter.js
import log from '@src/shared/infra/log/logService';
import zeroEx from '@src/shared/integration/external/zeroXClient';

const CHAIN_IDS = {
  ethereum: 1, eth: 1,
  bsc: 56, binance: 56,
  polygon: 137, poly: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114, avax: 43114,
  base: 8453,
};
const toChainId = (c) =>
  CHAIN_IDS[String(c).toLowerCase()] ??
  (Number(c) > 0 ? Number(c) : (() => { throw new Error(`Unsupported chain: ${c}`); })());

const assertAddr = (a, name) => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(a || ''))) {
    throw new Error(`Invalid ${name}: ${a}`);
  }
};

/** Return correct address for ERC20 vs native tokens */
function resolveTokenAddress(token, chain) {
  if (!token) return null;

  const symbol = String(token.symbol || '').toUpperCase();
  const addr   = String(token.address || '').toLowerCase();

  // Mantle special-case for native MNT
  if (String(chain || '').toLowerCase() === 'mantle') {
    if (symbol === 'MNT') return '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000';
  }

  // Normal native representations
  if (!addr ||
    addr === 'native' ||
    addr === '0x0' ||
    addr === '0x0000000000000000000000000000000000000000') {
    return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  }

  return token.address;
}

const normalize = ({ raw, chain, fromToken, toToken, taker }) => {
  const tx = raw?.transaction || {};
  const issues = raw?.issues || {};
  const needApproval = Boolean(
    raw?.allowanceTarget &&
    issues?.allowance &&
    BigInt(issues.allowance.actual || '0') < BigInt(raw?.sellAmount || '0')
  );

  return {
    canSwap: true,
    provider: '0x-allowance-holder',
    chain,
    fromToken, toToken, taker,
    // amounts (base units)
    sellAmount: raw?.sellAmount,
    buyAmount: raw?.buyAmount,
    minBuyAmount: raw?.minBuyAmount,
    // pricing
    price: Number(raw?.price ?? 0),
    guaranteedPrice: raw?.guaranteedPrice,
    estimatedPriceImpact: raw?.estimatedPriceImpact,
    // approvals
    allowanceTarget: raw?.allowanceTarget,
    needApproval,
    // gas/tx
    gas: tx?.gas,
    gasPrice: tx?.gasPrice,
    totalNetworkFee: raw?.totalNetworkFee,
    tx, // raw tx object for execution
    issues,
    fees: raw?.fees,
    route: raw?.route,
    raw,
  };
};

function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  return p.toString();
}

export async function getPrice({
                                 chain,
                                 fromToken,
                                 toToken,
                                 amountBaseUnits,
                                 slippageBps = 100,
                                 taker,
                                 recipient,
                                 excludedSources,
                                 gasPrice,
                               }) {
  const chainId = toChainId(chain);

  // ✅ resolve first, then validate
  const sellToken = resolveTokenAddress(fromToken, chain);
  const buyToken  = resolveTokenAddress(toToken, chain);
  assertAddr(sellToken, 'sellToken');
  assertAddr(buyToken,  'buyToken');

  const params = qs({
    chainId,
    sellToken,
    buyToken,
    sellAmount: amountBaseUnits,
    slippageBps,
    taker,
    recipient,
    excludedSources,
    gasPrice,
  });

  try {
    const { data } = await zeroEx.get(`/swap/allowance-holder/price?${params}`);
    return normalize({ raw: data, chain, fromToken, toToken, taker });
  } catch (e) {
    log.error(e);
    return { canSwap: false, error: e?.message || String(e) };
  }
}

export async function getQuote({
                                 chain,
                                 fromToken,
                                 toToken,
                                 amountBaseUnits,
                                 slippageBps = 100,
                                 taker,
                                 recipient,
                                 excludedSources,
                                 gasPrice,
                                 swapFeeRecipient,
                                 swapFeeBps,
                                 swapFeeToken,
                                 sellEntireBalance,
                                 txOrigin,
                                 tradeSurplusRecipient,
                                 tradeSurplusMaxBps,
                               }) {
  const chainId = toChainId(chain);

  // ✅ resolve first, then validate
  const sellToken = resolveTokenAddress(fromToken, chain);
  const buyToken  = resolveTokenAddress(toToken, chain);
  assertAddr(sellToken, 'sellToken');
  assertAddr(buyToken,  'buyToken');
  assertAddr(taker,     'taker');

  const params = qs({
    chainId,
    sellToken,
    buyToken,
    sellAmount: amountBaseUnits,
    slippageBps,
    taker,
    recipient,
    excludedSources,
    gasPrice,
    swapFeeRecipient,
    swapFeeBps,
    swapFeeToken,
    sellEntireBalance,
    txOrigin,
    tradeSurplusRecipient,
    tradeSurplusMaxBps,
  });

  try {
    const { data } = await zeroEx.get(`/swap/allowance-holder/quote?${params}`);
    return normalize({ raw: data, chain, fromToken, toToken, taker });
  } catch (e) {
    log.error(e);
    return { canSwap: false, error: e?.message || String(e) };
  }
}

/** Build swap transaction from firm quote */
export function buildSwapTx(quote) {
  const tx = quote?.tx || quote?.raw?.transaction || {};
  const fromIsNative =
    !quote?.fromToken?.address ||
    quote?.fromToken?.address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  return {
    to: tx.to,
    data: tx.data,
    value: fromIsNative ? (tx.value ?? quote.sellAmount ?? '0x0') : (tx.value ?? '0x0'),
    gas: tx.gas,
    gasPrice: tx.gasPrice,
    chainId: tx.chainId,
    description: `Swap ${quote?.fromToken?.symbol}→${quote?.toToken?.symbol} via 0x`,
  };
}

/** Build ERC20 approve(tx) for AllowanceHolder (spender = allowanceTarget) */
export function buildApproveTx({ token, owner, spender, amount }) {
  // approve(address,uint256) => 0x095ea7b3
  const selector = '0x095ea7b3';
  const pad = (x) => x.replace(/^0x/, '').padStart(64, '0');
  const data = selector + pad(spender) + pad(BigInt(amount).toString(16));
  return {
    to: token.address,
    data,
    value: '0x0',
    description: `Approve ${token.symbol} for 0x AllowanceHolder`,
  };
}

const zeroExAdapter = { getPrice, getQuote, buildSwapTx, buildApproveTx };
export default zeroExAdapter;
