import { JsonRpcProvider } from 'ethers';
import moralis from '@src/shared/integration/external/moralisClient';

/**
 * Custom provider for chains (like SLX) where the RPC returns
 * blocks with "hash": null. ethers.js v6 rejects that as INVALID_ARGUMENT.
 * We intercept the raw JSON-RPC result and patch the null hash before
 * ethers tries to parse it.
 */
class SlxJsonRpcProvider extends JsonRpcProvider {
  async _perform(req) {
    const result = await super._perform(req);

    // Patch getBlock responses where hash is null
    if (req.method === 'getBlock' && result && typeof result === 'object') {
      if (result.hash === null || result.hash === undefined) {
        // Use a deterministic placeholder so ethers can parse
        result.hash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }
    }

    return result;
  }
}

export const evmProvider = {
  jsonRpcProvider: (rpcUrl) => {
    return new JsonRpcProvider(rpcUrl)
  },
  slxJsonRpcProvider: (rpcUrl) => {
    return new SlxJsonRpcProvider(rpcUrl);
  },
  txHistoryProvider: () => {
    return moralis;
  }
};
