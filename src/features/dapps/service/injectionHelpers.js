import { PROVIDER_ID } from '@features/dapps/service/dappBrowserConfig';

export const jsResolve = (id, ok, result) => {
  const json = JSON.stringify(result ?? null);
  return `
    (function(){
      try {
        var target = null;
        if (window.ethereum && Array.isArray(window.ethereum.providers)) {
          target = window.ethereum.providers.find(p => p && p.providerId === '${PROVIDER_ID}');
        }
        if (!target && window.ethereum && window.ethereum.providerId === '${PROVIDER_ID}') {
          target = window.ethereum;
        }
        if (target && typeof target._handleResponse === 'function') {
          target._handleResponse(${JSON.stringify(id)}, ${ok ? 'true' : 'false'}, ${json});
        }
      } catch (e) {}
    })();
  `;
};

export const jsEmit = (evt, payload) => {
  const json = JSON.stringify(payload ?? null);
  return `
    (function(){
      try {
        var target = null;
        if (window.ethereum && Array.isArray(window.ethereum.providers)) {
          target = window.ethereum.providers.find(p => p && p.providerId === '${PROVIDER_ID}');
        }
        if (!target && window.ethereum && window.ethereum.providerId === '${PROVIDER_ID}') {
          target = window.ethereum;
        }
        if (target && typeof target._emitEvent === 'function') {
          target._emitEvent(${JSON.stringify(evt)}, ${json});
        }
      } catch (e) {}
    })();
  `;
};
