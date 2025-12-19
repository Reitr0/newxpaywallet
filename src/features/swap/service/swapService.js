// src/features/swap/service/swapService.js
import { walletStore } from '@features/wallet/state/walletStore';
import zeroExAdapter from '@features/swap/adapter/zeroExAdapter';

const takerFor = (chain, explicit) => explicit
  ? String(explicit).toLowerCase()
  : walletStore.getWalletAddressByChain?.call(walletStore, chain);

export const swapService = {
  async price({ chain, fromToken, toToken, amountBaseUnits, slippageBps, takerAddress, ...rest }) {
    const taker = takerFor(chain, takerAddress);
    return zeroExAdapter.getPrice({ chain, fromToken, toToken, amountBaseUnits, slippageBps, taker, ...rest });
  },

  async quote({ chain, fromToken, toToken, amountBaseUnits, slippageBps, takerAddress, ...rest }) {
    const taker = takerFor(chain, takerAddress);
    if (!taker) return { canSwap:false, error: 'Missing taker' };
    return zeroExAdapter.getQuote({ chain, fromToken, toToken, amountBaseUnits, slippageBps, taker, ...rest });
  },

  buildApproveTx({ token, spender, amount }) {
    return zeroExAdapter.buildApproveTx({ token, spender, amount });
  },

  async executeApprove({ chain, fromAddress, token, spender, amount }) {
    const tx = zeroExAdapter.buildApproveTx({ token, owner: fromAddress, spender, amount });
    return walletStore.sendTransaction({ chain, from: fromAddress, ...tx });
  },

  async executeSwap({ chain, fromAddress, quote }) {
    const tx = zeroExAdapter.buildSwapTx(quote);
    return walletStore.sendTransaction({ chain, from: fromAddress, ...tx });
  },
};

export default swapService;
