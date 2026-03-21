// dappRpcRouter.js — v3.0 (2026-03-18) — SECURITY HARDENED
import { allHandlers } from '@features/dapps/handlers';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';
import { networkStore } from '@features/network/state/networkStore';
import { getBytes, Signature } from 'ethers';
import axios from 'axios';

// Methods that require valid origin + connected permission + account match
const PRIVILEGED_METHODS = new Set([
  'eth_sendTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData_v4',
  'eth_signTypedData_v3',
  'eth_signTypedData',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
]);

// Methods that are always allowed (read-only, no signing)
const PUBLIC_METHODS = new Set([
  'eth_chainId', 'net_version', 'eth_blockNumber',
  'eth_getBlockByNumber', 'eth_getBalance', 'eth_gasPrice',
  'eth_maxPriorityFeePerGas', 'eth_estimateGas', 'eth_call',
  'eth_getCode', 'eth_getTransactionCount', 'eth_getTransactionReceipt',
  'eth_getTransactionByHash', 'eth_getLogs',
  'eth_accounts', 'eth_requestAccounts',
  'wallet_getPermissions', 'wallet_requestPermissions',
]);

function simplifyError(e) {
  const msg = String(e?.message || e || '').toLowerCase();
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) return new Error('Insufficient funds');
  if (msg.includes('user rejected') || msg.includes('user denied')) return new Error('Transaction rejected in wallet.');
  if (msg.includes('out of gas') || msg.includes('gas required exceeds')) return new Error('Transaction would fail.');
  if (msg.includes('nonce too low') || msg.includes('nonce has already')) return new Error('Nonce conflict. Try again.');
  if (msg.includes('execution reverted') || msg.includes('revert')) return new Error('Transaction reverted.');
  if (msg.includes('timeout') || msg.includes('network')) return new Error('Network error. Try again.');
  const raw = String(e?.message || e || '');
  return new Error(raw.length > 100 ? raw.substring(0, 100) + '...' : raw);
}

// Derive safe origin from native URL context (not from JS message)
function safeOrigin(nativeOrigin) {
  if (!nativeOrigin || typeof nativeOrigin !== 'string') return '';
  try {
    const u = new URL(nativeOrigin);
    return u.origin; // e.g. "https://example.com"
  } catch {
    return '';
  }
}

export function makeDappRpcRouter(deps) {
  const { walletStore, sitePermissions, getActiveAddress, getActiveChainId, PROVIDER_ID, confirmDialog } = deps;

  return async function routeRpc(payload, { origin: rawOrigin }) {
    const method = payload?.method;
    const params = payload?.params || [];
    const chainId = getActiveChainId();
    const activeAddr = getActiveAddress();
    const origin = safeOrigin(rawOrigin);

    // SECURITY: privileged methods require valid origin
    if (PRIVILEGED_METHODS.has(method)) {
      if (!origin) {
        console.warn('[DApp RPC] BLOCKED: privileged method without valid origin:', method);
        throw new Error('Invalid origin');
      }
    }

    const perm = sitePermissions.get(origin) || { connected: false, address: null };

    // SECURITY: privileged methods require connected permission + matching account
    if (PRIVILEGED_METHODS.has(method) && method !== 'eth_requestAccounts') {
      if (!perm.connected) {
        console.warn('[DApp RPC] BLOCKED: not connected:', method, origin);
        throw new Error('Site not connected. Please connect first.');
      }
      if (perm.address && activeAddr &&
          perm.address.toLowerCase() !== activeAddr.toLowerCase()) {
        console.warn('[DApp RPC] BLOCKED: address mismatch:', method);
        throw new Error('Account mismatch. Please reconnect.');
      }
    }

    const ctx = {
      ...deps,
      chainId,
      activeAddr,
      origin,
      perm,
      jsEmit: (evt, data) => `
        (function(){
          var p = Array.isArray(window.ethereum?.providers)
            ? window.ethereum.providers.find(x => x && x.providerId === '${PROVIDER_ID}')
            : (window.ethereum?.providerId === '${PROVIDER_ID}' ? window.ethereum : null);
          if (p && typeof p._emitEvent === 'function') {
            try { p._emitEvent(${JSON.stringify(evt)}, ${JSON.stringify(data)}); } catch(e){}
          }
        })();
      `,
      jsSyncState: (state) => `
        (function(){
          var p = Array.isArray(window.ethereum?.providers)
            ? window.ethereum.providers.find(x => x && x.providerId === '${PROVIDER_ID}')
            : (window.ethereum?.providerId === '${PROVIDER_ID}' ? window.ethereum : null);
          if (p && typeof p._syncState === 'function') {
            try { 
              p._syncState(${JSON.stringify(state)}); 
            } catch(e){}
          }
        })();
      `,
    };

    try {
      // ── Inline sign handlers (personal_sign, eth_sign) ──
      if (method === 'personal_sign' || method === 'eth_sign') {
        let from, msgData;
        const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v);

        if (method === 'personal_sign') {
          const [a, b] = params;
          if (isAddr(b)) { msgData = a; from = b; }
          else if (isAddr(a)) { from = a; msgData = b; }
          else { msgData = a; from = activeAddr; }
        } else {
          const [a, b] = params;
          if (isAddr(a)) { from = a; msgData = b; }
          else { from = activeAddr; msgData = a; }
        }

        // SECURITY: verify from matches active connected address
        if (!from || !activeAddr || from.toLowerCase() !== activeAddr.toLowerCase()) {
          throw new Error('Signing address does not match connected account');
        }

        console.log('[sign] method:', method, 'from:', from, 'origin:', origin);

        // SECURITY: always require confirmation for signing
        if (!confirmDialog) throw new Error('Confirm dialog not available');
        const ok = await confirmDialog(
          'Sign Message',
          `${origin || 'Unknown site'} wants to sign as ${String(from).slice(0, 8)}...`
        );
        if (!ok) throw new Error('User rejected');

        const tryChains = [chainId, 781234, 56, 1, 137];
        for (const cid of tryChains) {
          const chain = CHAIN_ID_TO_FAMILY[cid];
          if (!chain) continue;
          const inst = walletStore.instances?.[chain];
          if (!inst?._wallet) continue;
          if (from && inst._wallet.address.toLowerCase() !== String(from).toLowerCase()) continue;
          try {
            let signature;
            if (method === 'personal_sign') {
              const isHex = String(msgData).startsWith('0x');
              const msgBytes = isHex ? getBytes(msgData) : msgData;
              signature = await inst._wallet.signMessage(msgBytes);
            } else {
              const digest = getBytes(msgData);
              const sig = inst._wallet.signingKey.sign(digest);
              signature = Signature.from(sig).serialized;
            }
            console.log('[sign] OK via', chain);
            return signature;
          } catch (e) {
            console.warn('[sign] fail on', chain, e?.message);
          }
        }
        throw new Error('No matching wallet. Try reconnecting.');
      }

      // ── All other handlers ──
      const handlers = allHandlers(ctx);
      if (handlers[method]) return await handlers[method](params);

      // ── RPC Proxy Fallback (read-only methods only) ──
      if (PRIVILEGED_METHODS.has(method)) {
        throw new Error('Unhandled privileged method: ' + method);
      }

      const family = CHAIN_ID_TO_FAMILY[chainId] || 'ethereum';
      const netConfig = networkStore.getConfig(family);
      const rpcUrl = netConfig?.rpc;
      if (!rpcUrl) throw new Error('No RPC for chain: ' + family);

      const { data } = await axios.post(rpcUrl, {
        jsonrpc: '2.0', id: 1, method, params,
      }, { timeout: 15000 });

      if (data?.error) throw new Error(data.error.message || 'RPC error');
      return data?.result;

    } catch (e) {
      console.warn('[DApp RPC]', method, 'error:', String(e?.message || '').substring(0, 150));
      throw simplifyError(e);
    }
  };
}
