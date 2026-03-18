// src/features/browser/services/rpcHandlers/blockHandlers.js
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const ZERO_NONCE = '0x0000000000000000';
const ZERO_BLOOM = '0x' + '0'.repeat(512);

export const blockHandlers = (ctx) => ({
  // eth_blockNumber → returns just the hex block number string
  async eth_blockNumber() {
    const { walletStore, chainId } = ctx;
    const bn = await walletStore.getBlockNumber(chainId);
    return '0x' + BigInt(bn ?? 0).toString(16);
  },

  // eth_getBlockByNumber → returns full block object
  async eth_getBlockByNumber() {
    const { walletStore, chainId } = ctx;
    const bn = await walletStore.getBlockNumber(chainId);
    const blockNumHex = '0x' + BigInt(bn ?? 0).toString(16);
    const blockHash = '0x' + BigInt(bn ?? 1).toString(16).padStart(64, '0');
    const tsHex = '0x' + Math.floor(Date.now() / 1000).toString(16);

    return {
      number: blockNumHex,
      hash: blockHash,
      parentHash: ZERO_HASH,
      sha3Uncles: ZERO_HASH,
      logsBloom: ZERO_BLOOM,
      transactionsRoot: ZERO_HASH,
      stateRoot: ZERO_HASH,
      receiptsRoot: ZERO_HASH,
      miner: ZERO_ADDR,
      difficulty: '0x0',
      totalDifficulty: '0x0',
      extraData: '0x',
      size: '0x0',
      gasLimit: '0x1c9c380',
      gasUsed: '0x0',
      timestamp: tsHex,
      nonce: ZERO_NONCE,
      mixHash: ZERO_HASH,
      baseFeePerGas: '0x0',
      uncles: [],
      transactions: [],
    };
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
