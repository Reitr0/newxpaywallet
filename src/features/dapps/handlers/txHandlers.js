// src/features/browser/services/rpcHandlers/txHandlers.js
import { formatEther, parseEther } from 'ethers';

const isHex = (v) => typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v);
const isNil = (v) => v == null || v === '';

/** value: decimals in ETH -> bigint (wei); hex -> bigint; integer string -> parseEther */
function toWeiValue(v) {
  if (isNil(v)) return undefined;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);         // assume already wei (rare)
  const s = String(v);
  if (isHex(s)) return BigInt(s);
  // if it looks like a decimal or plain integer, treat it as ETH and convert to wei
  return parseEther(s); // supports "1", "0.01", etc.
}

/** fee / gas / nonce fields: hex -> bigint; integer string/number -> bigint */
function toBigInt(v) {
  if (isNil(v)) return undefined;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  const s = String(v);
  return isHex(s) ? BigInt(s) : BigInt(s);
}

/** Rebuild a dapp tx into an ethers-compatible request */
function normalizeDappTx(dappTx) {
  const t = { ...dappTx };

  // common fields
  const req = {
    to: t.to ?? undefined,
    data: isNil(t.data) ? undefined : t.data,
    value: toWeiValue(t.value),
    gasLimit: toBigInt(t.gas ?? t.gasLimit),
    nonce: toBigInt(t.nonce),
  };

  // normalize type
  let typeNorm;
  if (!isNil(t.type)) {
    typeNorm = isHex(t.type) ? parseInt(t.type, 16) : Number(t.type);
  }

  if (typeNorm === 2) {
    // EIP-1559
    req.type = 2;
    req.maxFeePerGas = toBigInt(t.maxFeePerGas);
    req.maxPriorityFeePerGas = toBigInt(t.maxPriorityFeePerGas);
    // ignore gasPrice if present
  } else if (typeNorm === 0 || typeNorm === undefined) {
    // Legacy (or dapp left type blank)
    if (typeNorm === 0) req.type = 0;
    req.gasPrice = toBigInt(t.gasPrice);
  } else {
    // Unknown type, let ethers decide but keep provided fields
    req.type = typeNorm;
  }

  return req;
}

export const txHandlers = (ctx) => ({
  async eth_sendTransaction(params) {
    const { walletStore, chainId, activeAddr, confirmDialog } = ctx;
    const tx = params?.[0] || {};
    if (!tx?.from) throw new Error('Invalid tx');
    if (!activeAddr || activeAddr.toLowerCase() !== String(tx.from).toLowerCase()) {
      throw new Error('Invalid from address');
    }

    // Optional: quick human preview
    const toLabel = tx.to || '(contract)';
    const amountEth = (() => {
      try {
        return tx.value ? formatEther(toWeiValue(tx.value)) : '0';
      } catch { return '0'; }
    })();

    const ok = await confirmDialog(
      'Send transaction',
      `From: ${tx.from}\nTo: ${toLabel}\nAmount: ${amountEth} ETH`
    );
    if (!ok) throw new Error('User rejected');

    // ✅ Rebuild tx for ethers/provider
    const normalized = normalizeDappTx(tx);

    // Hand off to your wallet store (use your dapps-specific send if you have it)
    if (typeof walletStore.sendDappsTransaction === 'function') {
      return await walletStore.sendDappsTransaction(normalized, chainId);
    }
    // fallback
    return await walletStore.sendTransaction(normalized, chainId);
  },

  async eth_estimateGas(params) {
    const { walletStore, chainId } = ctx;
    const normalized = normalizeDappTx(params?.[0] || {});
    const gas = await walletStore.estimateGas(normalized, chainId);
    return '0x' + BigInt(gas ?? 0).toString(16);
  },

  async eth_call(params) {
    const { walletStore, chainId } = ctx;
    const normalized = normalizeDappTx(params?.[0] || {});
    return await walletStore.call(normalized, chainId);
  },
});
