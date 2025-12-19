// src/features/browser/services/rpcHandlers/blockHandlers.js
export const blockHandlers = (ctx) => ({
  async eth_blockNumber() {
    const { walletStore, chainId } = ctx;
    const bn = await walletStore.getBlockNumber(chainId);
    return { number: '0x' + BigInt(bn ?? 0).toString(16), hash: null, transactions: [] };
  },

  async eth_getBlockByNumber() {
    const { walletStore, chainId } = ctx;
    const bn = await walletStore.getBlockNumber(chainId);
    return { number: '0x' + BigInt(bn ?? 0).toString(16), hash: null, transactions: [] };
  },

  async eth_getBalance([addr]) {
    const { walletStore, chainId } = ctx;
    const bal = await walletStore.getBalance?.(addr, chainId);
    return '0x' + BigInt(bal ?? 0).toString(16);
  },

  async eth_gasPrice() {
    const { walletStore, chainId } = ctx;
    const gp = await walletStore.getGasPrice?.(chainId);
    return typeof gp === 'bigint' ? '0x' + gp.toString(16) : gp || '0x3b9aca00';
  },

  async eth_maxPriorityFeePerGas() {
    return '0x59682f00'; // 1.5 gwei
  },
});
