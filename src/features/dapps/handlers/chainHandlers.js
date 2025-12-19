// src/features/browser/services/rpcHandlers/chainHandlers.js
import { dappBrowserStore } from '@features/dapps/state/dappBrowserStore';
import logService from '@src/shared/infra/log/logService';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';

export const chainHandlers = (ctx) => ({
  /**
   * DApp asks to switch to another chain (EIP-3326)
   */
  async wallet_switchEthereumChain(params) {
    const { walletStore, webref, PROVIDER_ID, confirmDialog, t } = ctx;
    const targetHex = String(params?.[0]?.chainId || '').toLowerCase();
    if (!/^0x[0-9a-f]+$/.test(targetHex)) throw new Error('Invalid chainId');

    const targetNum = parseInt(targetHex, 16);

    // 🧠 Ask user for confirmation
    const ok = await confirmDialog(
      t?.('dapp.switchNetworkTitle', 'Switch Network'),
      t?.('dapp.switchNetworkMessage', {
        defaultValue: 'Allow this site to switch your network to chain {{chainId}}?',
        chainId: CHAIN_ID_TO_FAMILY[targetNum],
      }),
      {
        variant: 'switch',
        confirmText: t?.('common.switch', 'Switch'),
        cancelText: t?.('common.cancel', 'Cancel'),
      }
    );

    if (!ok) throw new Error(t?.('errors.userRejected', 'User rejected'));

    dappBrowserStore.setActiveChainId(targetNum);

    try {
      await walletStore.switchChain(targetNum);
    } catch (e) {
      logService.warn('switchChain failed:', e?.message);
      throw new Error(`Chain ${targetHex} not supported`);
    }

    // ✅ sync provider in webview
    webref.current?.injectJavaScript(`
      (function(){
        var p = Array.isArray(window.ethereum?.providers)
          ? window.ethereum.providers.find(x => x && x.providerId === '${PROVIDER_ID}')
          : (window.ethereum?.providerId === '${PROVIDER_ID}' ? window.ethereum : null);
        if (p) {
          p.chainId = '${targetHex}';
          try { p._emitEvent('chainChanged', '${targetHex}'); } catch(e){}
        }
      })();
    `);

    logService.info('Switched chain', targetNum);
    return null;
  },
});
