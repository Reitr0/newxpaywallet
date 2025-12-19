// src/features/browser/services/rpcHandlers/coreHandlers.js
export const coreHandlers = (ctx) => ({
  async eth_chainId() {
    const { chainId, toHexChainId, webref, jsEmit } = ctx;
    const hex = toHexChainId(chainId);
    webref.current?.injectJavaScript(jsEmit('chainChanged', hex));
    return hex;
  },

  async net_version() {
    return String(ctx.chainId);
  },

  async web3_clientVersion() {
    return 'VPocket/1.0 (EIP-1193)';
  },
});
