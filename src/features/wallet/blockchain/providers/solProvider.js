import { Connection } from '@solana/web3.js';

export const solProvider = {
  txHistoryProvider: (rpcUrl) => {
    return new Connection(rpcUrl, 'confirmed');
  }
};
