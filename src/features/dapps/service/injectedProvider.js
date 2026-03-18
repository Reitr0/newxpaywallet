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
    catch (e) { console.warn('Failed to send message to native:', e); }
  }

  function emit(evt, payload) {
    console.log('[VP Provider] Emitting event:', evt, payload);
    (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch(e) { console.warn('Event listener error:', e); } });
    try { document.dispatchEvent(new CustomEvent('vpocket:' + evt, { detail: payload })); } catch(e) {}
  }

  function normalizeError(err) {
    var msg = '';
    if (err && typeof err === 'object') {
      msg = err.message || err.reason || JSON.stringify(err);
    } else {
      msg = String(err || 'Rejected');
    }
    // If message is already short (translated by native), pass through
    if (msg.length <= 80) return { code: err?.code || 4001, message: msg };
    // Truncate long messages
    return { code: err?.code || 4001, message: msg.substring(0, 80) + '...' };
  }

  const provider = {
    providerId: '${PROVIDER_ID}',
    name: '${PROVIDER_NAME}',
    logo: '${PROVIDER_LOGO}',
    is${PROVIDER_NAME}: true,
    isVCOIN: true,
    isMetaMask: false, // Explicitly set to false to avoid conflicts

    selectedAddress: null,
    chainId: '0x1', // Default to Ethereum mainnet
    
    // EIP-1193 required properties
    isConnected(){ 
      const connected = !!this.selectedAddress;
      console.log('[VP Provider] isConnected:', connected, 'address:', this.selectedAddress);
      return connected;
    },
    
    // Make provider "discoverable" even before connection
    _isReady: true,
    _initialized: true,

    request: function (args) {
      const id = String(_reqId++);
      console.log('[VP Provider] Request:', args, 'ID:', id);

      // Auto-inject 'from' address for tx-like RPC calls
      var method = args && args.method;
      if (method === 'eth_estimateGas' || method === 'eth_call' || method === 'eth_sendTransaction') {
        var params = args.params;
        if (Array.isArray(params) && params[0] && typeof params[0] === 'object') {
          if (!params[0].from && provider.selectedAddress) {
            params[0].from = provider.selectedAddress;
            console.log('[VP Provider] Injected from:', provider.selectedAddress, 'into', method);
          }
        }
      }

      // Normalize personal_sign / eth_sign params
      // Ensure order is always: [message, address]
      if (method === 'personal_sign') {
        var p = args.params || [];
        var isEthAddr = function(v) { return /^0x[0-9a-fA-F]{40}$/.test(v); };
        if (p.length >= 2) {
          if (isEthAddr(p[0]) && !isEthAddr(p[1])) {
            // Swap: [address, message] -> [message, address]
            args.params = [p[1], p[0]];
            console.log('[VP Provider] personal_sign: swapped params to [msg, addr]');
          }
        } else if (p.length === 1 && provider.selectedAddress) {
          // Only message, add address
          args.params = [p[0], provider.selectedAddress];
          console.log('[VP Provider] personal_sign: added address', provider.selectedAddress);
        }
        // Ensure address is always present
        if (args.params && args.params.length >= 2 && !isEthAddr(args.params[1]) && provider.selectedAddress) {
          args.params[1] = provider.selectedAddress;
          console.log('[VP Provider] personal_sign: forced address to', provider.selectedAddress);
        }
        console.log('[VP Provider] personal_sign final params:', args.params);
      }

      // eth_sign: ensure [address, messageHash], inject address if needed
      if (method === 'eth_sign') {
        var ep = args.params || [];
        if (ep.length >= 1 && !/^0x[0-9a-fA-F]{40}$/.test(ep[0]) && provider.selectedAddress) {
          args.params = [provider.selectedAddress, ep[0]];
          console.log('[VP Provider] eth_sign: injected address', provider.selectedAddress);
        } else if (ep.length === 1 && provider.selectedAddress) {
          args.params = [provider.selectedAddress, ep[0]];
        }
      }

      return new Promise(function (resolve, reject) {
        pending[id] = { resolve, reject };
        const payload = (args && typeof args === 'object') ? args : { method: String(args || '') };
        sendToNative({ type: 'provider_request', id, payload, origin: location.origin });
        setTimeout(function () {
          if (pending[id]) {
            console.warn('[VP Provider] Request timeout for ID:', id);
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

    on(evt, cb) { 
      console.log('[VP Provider] Adding listener for:', evt);
      (listeners[evt] = listeners[evt] || []).push(cb); 
      return this; 
    },
    once(evt, cb) { const w = (v)=>{ try{cb(v);}finally{this.removeListener(evt,w);} }; return this.on(evt, w); },
    removeListener(evt, cb) { listeners[evt]=(listeners[evt]||[]).filter(f=>f!==cb); return this; },
    removeAllListeners(evt) { if (evt) delete listeners[evt]; else Object.keys(listeners).forEach(k=>delete listeners[k]); return this; },

    _handleResponse(id, ok, result) { 
      console.log('[VP Provider] Response:', { id, ok, result });
      const p = pending[id]; 
      if (!p) return; 
      ok ? p.resolve(result) : p.reject(normalizeError(result)); 
      delete pending[id]; 
    },
    _emitEvent(evt, payload) { 
      console.log('[VP Provider] _emitEvent:', evt, payload);
      emit(evt, payload); 
    },
    _syncState(state) { 
      console.log('[VP Provider] _syncState called with:', state);
      if (state && typeof state==='object'){ 
        if('selectedAddress' in state) {
          this.selectedAddress = state.selectedAddress;
          console.log('[VP Provider] Updated selectedAddress:', this.selectedAddress);
        }
        if('chainId' in state) {
          this.chainId = state.chainId;
          console.log('[VP Provider] Updated chainId:', this.chainId);
        }
        
        // Force update isConnected status
        console.log('[VP Provider] Connection status after sync:', this.isConnected());
      } 
    },

    isConnected(){ 
      const connected = !!this.selectedAddress;
      console.log('[VP Provider] isConnected:', connected, 'address:', this.selectedAddress);
      return connected;
    },
    enable(){ 
      console.log('[VP Provider] enable() called');
      return this.request({ method: 'eth_requestAccounts' }); 
    },

    autoRefreshOnNetworkChange: false,
    isMetaMask: false, // Important: set to false
    
    // EIP-1193 event emitter interface
    _events: {},
    emit(event, ...args) {
      console.log('[VP Provider] emit:', event, args);
      const handlers = this._events[event] || [];
      handlers.forEach(handler => {
        try { handler(...args); } catch(e) { console.warn('Event handler error:', e); }
      });
    },
  };

  // EIP-6963
  (function setupEIP6963(){
    try {
      var vpInfo = { 
        uuid: 'd1d9c1e7-6aa0-4466-9b93-7c0e8b2a', 
        name: '${PROVIDER_NAME}', 
        icon: '${PROVIDER_LOGO}', 
        rdns: 'app.vpocket.wallet' 
      };
      
      var announceProvider = function() {
        console.log('[VP Provider] Announcing via EIP-6963');
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { 
          detail: Object.freeze({ 
            info: Object.freeze(vpInfo), 
            provider: provider 
          }) 
        }));
      };
      
      // Listen for requests
      window.addEventListener('eip6963:requestProvider', announceProvider);
      
      // Announce immediately
      setTimeout(announceProvider, 0);
      
      // Announce again after a delay (some DApps might miss the first one)
      setTimeout(announceProvider, 100);
      setTimeout(announceProvider, 500);
      setTimeout(announceProvider, 1000);
    } catch(e) {
      console.warn('[VP Provider] EIP-6963 setup failed:', e);
    }
  })();

  // MetaMask compatibility shim
  try { 
    provider.isMetaMask = true; 
    provider._metamask = { 
      isUnlocked: () => Promise.resolve(true), 
      isEnabled: () => Promise.resolve(true) 
    }; 
  } catch(e){}

  // Set as primary provider
  if (!window.ethereum) {
    window.ethereum = provider;
    console.log('[VP Provider] Set as primary ethereum provider');
  } else {
    // Multi-provider support
    if (!Array.isArray(window.ethereum.providers)) {
      window.ethereum.providers = [window.ethereum];
    }
    if (!window.ethereum.providers.find(p => p && p.providerId === provider.providerId)) {
      window.ethereum.providers.push(provider);
      console.log('[VP Provider] Added to providers array');
    }
    // Also set as primary if current provider is not initialized
    if (!window.ethereum._initialized) {
      window.ethereum = provider;
      console.log('[VP Provider] Replaced uninitialized provider');
    }
  }

  // Also set legacy web3
  window.web3 = window.web3 || {};
  window.web3.currentProvider = provider;
  
  // Expose provider globally for debugging
  window.vcoinProvider = provider;

  console.log('[VP Provider] Injection complete');
  console.log('[VP Provider] window.ethereum:', window.ethereum);
  console.log('[VP Provider] Provider methods:', Object.getOwnPropertyNames(provider));
  console.log('[VP Provider] Provider ready:', provider._isReady);
  console.log('[VP Provider] Provider initialized:', provider._initialized);

  // Dispatch initialization events
  window.dispatchEvent(new Event('ethereum#initialized'));
  
  // Also dispatch for legacy detection
  setTimeout(function() {
    window.dispatchEvent(new Event('web3Ready'));
    console.log('[VP Provider] Dispatched web3Ready event');
  }, 100);
  
})();
`;
}
