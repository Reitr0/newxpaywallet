import tronClient from '@src/shared/integration/external/tronClient';
export const tronProvider = {
  txHistoryProvider: () => {
    return tronClient;
  }
};
