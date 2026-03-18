// dappRpcRouter.js — v2.3 (2026-02-22)
import { allHandlers } from '@features/dapps/handlers';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';
import { networkStore } from '@features/network/state/networkStore';
import { getBytes, Signature } from 'ethers';
import axios from 'axios';

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

export function makeDappRpcRouter(deps) {
  const { walletStore, sitePermissions, getActiveAddress, getActiveChainId, PROVIDER_ID, confirmDialog } = deps;

  return async function routeRpc(payload, { origin }) {
    const method = payload?.method;
    const params = payload?.params || [];
    const chainId = getActiveChainId();
    const activeAddr = getActiveAddress();
    const perm = sitePermissions.get(origin) || { connected: false, address: null };

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
      // ── Inline sign handlers ──
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

        console.log('[sign] method:', method, 'from:', from);

        if (confirmDialog) {
          const ok = await confirmDialog('Sign Message', 'Sign as ' + String(from) + '?');
          if (!ok) throw new Error('User rejected');
        }

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

      // ── RPC Proxy Fallback ──
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
