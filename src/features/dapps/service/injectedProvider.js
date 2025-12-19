// src/features/browser/services/injectedProvider.js
export function buildInjectedProviderScript(meta) {
  const { PROVIDER_ID, PROVIDER_NAME, PROVIDER_LOGO } = meta;

  return `
(function () {

  if (window.__VP_INJECTED__) return;
  window.__VP_INJECTED__ = true;

  const pending = Object.create(null);
  const listeners = Object.create(null);
  let _reqId = 1;

  function sendToNative(msg) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
    catch (e) {}
  }

  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch(e) {} });
    try { document.dispatchEvent(new CustomEvent('vpocket:' + evt, { detail: payload })); } catch(e) {}
  }

  function normalizeError(err) {
    if (err && typeof err === 'object') return err;
    return { code: 4001, message: String(err || 'Rejected') };
  }

  const provider = {
    providerId: '${PROVIDER_ID}',
    name: '${PROVIDER_NAME}',
    logo: '${PROVIDER_LOGO}',
    is${PROVIDER_NAME}: true,

    selectedAddress: null,
    chainId: null,

    request: function (args) {
      const id = String(_reqId++);
      return new Promise(function (resolve, reject) {
        pending[id] = { resolve, reject };
        const payload = (args && typeof args === 'object') ? args : { method: String(args || '') };
        sendToNative({ type: 'provider_request', id, payload, origin: location.origin });
        setTimeout(function () {
          if (pending[id]) {
            pending[id].reject(normalizeError({ code: -32002, message: 'Wallet timeout' }));
            delete pending[id];
          }
        }, 120000);
      });
    },

    send: function (methodOrPayload, cbOrArgs) {
      if (typeof methodOrPayload === 'string') {
        return this.request({ method: methodOrPayload, params: cbOrArgs });
      }
      const payload = methodOrPayload || {};
      const callback = cbOrArgs;
      this.request({ method: payload.method, params: payload.params }).then(
        (result) => callback && callback(null, { id: payload.id, jsonrpc: '2.0', result }),
        (err)    => callback && callback(err,   { id: payload.id, jsonrpc: '2.0', error: err })
      );
    },
    sendAsync: function (payload, callback) { return this.send(payload, callback); },

    on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); return this; },
    once(evt, cb) { const w = (v)=>{ try{cb(v);}finally{this.removeListener(evt,w);} }; return this.on(evt, w); },
    removeListener(evt, cb) { listeners[evt]=(listeners[evt]||[]).filter(f=>f!==cb); return this; },
    removeAllListeners(evt) { if (evt) delete listeners[evt]; else Object.keys(listeners).forEach(k=>delete listeners[k]); return this; },

    _handleResponse(id, ok, result) { const p = pending[id]; if (!p) return; ok ? p.resolve(result) : p.reject(normalizeError(result)); delete pending[id]; },
    _emitEvent(evt, payload) { emit(evt, payload); },
    _syncState(state) { if (state && typeof state==='object'){ if('selectedAddress' in state) this.selectedAddress=state.selectedAddress; if('chainId' in state) this.chainId=state.chainId; } },

    isConnected(){ return !!this.selectedAddress; },
    enable(){ return this.request({ method: 'eth_requestAccounts' }); },

    autoRefreshOnNetworkChange:false,
    isMetaMask:false,
  };

  // EIP-6963
  (function setupEIP6963(){
    try {
      var vpInfo = { uuid: 'd1d9c1e7-6aa0-4466-9b93-7c0e8b2a', name: '${PROVIDER_NAME}', icon: '${PROVIDER_LOGO}', rdns: 'app.vpocket.wallet' };
      window.addEventListener('eip6963:requestProvider', function(){
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info: Object.freeze(vpInfo), provider }) }));
      });
      setTimeout(function(){
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info: Object.freeze(vpInfo), provider }) }));
      }, 0);
    } catch(e) {}
  })();

  // MetaMask compatibility shim
  try { provider.isMetaMask = true; provider._metamask = { isUnlocked: () => true, isEnabled: () => true }; } catch(e){}

  if (!window.ethereum) {
    window.ethereum = provider;
  } else {
    if (!Array.isArray(window.ethereum.providers)) window.ethereum.providers = [window.ethereum];
    if (!window.ethereum.providers.find(p => p && p.providerId === provider.providerId)) window.ethereum.providers.push(provider);
  }

  window.dispatchEvent(new Event('ethereum#initialized'));
})();
`;
}
