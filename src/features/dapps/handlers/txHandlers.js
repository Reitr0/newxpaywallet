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
    from: t.from ?? undefined,
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
    const { walletStore, chainId, activeAddr, confirmDialog, perm, origin } = ctx;
    const tx = params?.[0] || {};

    // SECURITY: require confirmDialog
    if (!confirmDialog) throw new Error('Confirm dialog not available');

    // SECURITY: require connected permission
    if (!perm?.connected) {
      throw new Error('Site not connected');
    }

    if (!tx?.from) throw new Error('Invalid tx');
    if (!activeAddr || activeAddr.toLowerCase() !== String(tx.from).toLowerCase()) {
      throw new Error('Invalid from address');
    }

    // SECURITY: from must match connected address
    if (perm.address && perm.address.toLowerCase() !== String(tx.from).toLowerCase()) {
      throw new Error('Account mismatch');
    }

    const toLabel = tx.to || (ctx.t ? ctx.t('dappConfirm.contract') : '(contract)');
    const amountEth = (() => {
      try {
        return tx.value ? formatEther(toWeiValue(tx.value)) : '0';
      } catch { return '0'; }
    })();

    const t = ctx.t || ((k, fb) => fb || k);
    // SECURITY: show site origin in confirm dialog
    const siteLabel = origin || 'Unknown site';
    const ok = await confirmDialog(
      t('dappConfirm.sendTransaction', 'Send transaction'),
      `${siteLabel}\n\n${t('dappConfirm.from', 'From')}: ${tx.from}\n${t('dappConfirm.to', 'To')}: ${toLabel}\n${t('dappConfirm.amount', 'Amount')}: ${amountEth} ETH`
    );
    if (!ok) throw new Error('User rejected');

    const normalized = normalizeDappTx(tx);

    if (typeof walletStore.sendDappsTransaction === 'function') {
      return await walletStore.sendDappsTransaction(normalized, chainId);
    }
    return await walletStore.sendTransaction(normalized, chainId);
  },

  async eth_estimateGas(params) {
    const { walletStore, chainId, activeAddr } = ctx;
    const normalized = normalizeDappTx(params?.[0] || {});
    // Ensure from address is set so RPC doesn't use zero address
    if (!normalized.from && activeAddr) {
      normalized.from = activeAddr;
    }
    const gas = await walletStore.estimateGas(normalized, chainId);
    return '0x' + BigInt(gas ?? 0).toString(16);
  },

  async eth_call(params) {
    const { walletStore, chainId, activeAddr } = ctx;
    const normalized = normalizeDappTx(params?.[0] || {});
    if (!normalized.from && activeAddr) {
      normalized.from = activeAddr;
    }
    return await walletStore.call(normalized, chainId);
  },
});
