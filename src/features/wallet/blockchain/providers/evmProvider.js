import { JsonRpcProvider } from 'ethers';
import moralis from '@src/shared/integration/external/moralisClient';

export const evmProvider = {
  jsonRpcProvider: (rpcUrl) => {
    return new JsonRpcProvider(rpcUrl)
  },
  txHistoryProvider: () => {
    return moralis;
  }
};
