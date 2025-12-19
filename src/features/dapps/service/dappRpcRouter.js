import { allHandlers } from '@features/dapps/handlers';

export function makeDappRpcRouter(deps) {
  const { walletStore, sitePermissions, getActiveAddress, getActiveChainId, PROVIDER_ID} = deps;

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
    };

    const handlers = allHandlers(ctx);
    if (handlers[method]) return await handlers[method](params);
    throw new Error('Method not supported: ' + method);
  };
}
