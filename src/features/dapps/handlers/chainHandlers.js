// src/features/browser/services/rpcHandlers/chainHandlers.js
import { dappBrowserStore } from '@features/dapps/state/dappBrowserStore';
import logService from '@src/shared/infra/log/logService';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';

const SUPPORTED_CHAINS = {
  '0x1': { name: 'Ethereum Mainnet', family: 'ethereum' },
  '0x38': { name: 'BSC Mainnet', family: 'bsc' },
  '0x89': { name: 'Polygon Mainnet', family: 'polygon' },
  '0xbebb2': { name: 'SLX Network', family: 'slx' },
};

export const chainHandlers = (ctx) => ({
  /**
   * eth_chainId - Return current chain ID
   */
  async eth_chainId() {
    const { chainId, toHexChainId } = ctx;
    const hexChainId = toHexChainId(chainId);
    console.log('[Chain Handler] eth_chainId returning:', hexChainId);
    return hexChainId;
  },

  /**
   * net_version - Return current network ID (same as chain ID for most networks)
   */
  async net_version() {
    const { chainId } = ctx;
    console.log('[Chain Handler] net_version returning:', String(chainId));
    return String(chainId);
  },

  /**
   * DApp asks to switch to another chain (EIP-3326)
   */
  async wallet_switchEthereumChain(params) {
    const { walletStore, webref, PROVIDER_ID, confirmDialog, jsSyncState, t } = ctx;
    const targetHex = String(params?.[0]?.chainId || '').toLowerCase();
    if (!/^0x[0-9a-f]+$/.test(targetHex)) throw new Error('Invalid chainId');

    const targetNum = parseInt(targetHex, 16);
    const chainInfo = SUPPORTED_CHAINS[targetHex];

    if (!chainInfo) {
      throw new Error(`Chain ${targetHex} not supported. Supported chains: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`);
    }

    // 🧠 Auto-approve for trusted DEX sites (slxdex.com)
    const origin = ctx.origin || '';
    const isTrustedDex = origin.includes('slxdex');
    let ok = isTrustedDex;
    if (!ok) {
      ok = await confirmDialog(
        t?.('dapp.switchNetworkTitle', 'Switch Network'),
        t?.('dapp.switchNetworkMessage', {
          defaultValue: 'Allow this site to switch your network to {{chainName}}?',
          chainName: chainInfo.name,
        }),
        {
          variant: 'switch',
          confirmText: t?.('common.switch', 'Switch'),
          cancelText: t?.('common.cancel', 'Cancel'),
        }
      );
    }

    if (!ok) throw new Error(t?.('errors.userRejected', 'User rejected'));

    // Update browser store
    const newAddress = walletStore.getWalletAddressByChain(chainInfo.family);
    if (!newAddress) {
      throw new Error(`No wallet found for ${chainInfo.name}`);
    }

    dappBrowserStore.setActiveWallet(newAddress, targetNum);

    try {
      await walletStore.switchChain(targetNum);
    } catch (e) {
      logService.warn('switchChain failed:', e?.message);
      throw new Error(`Failed to switch to chain ${targetHex}: ${e?.message}`);
    }

    // ✅ sync provider state in webview
    if (webref?.current) {
      if (jsSyncState) {
        webref.current.injectJavaScript(jsSyncState({
          selectedAddress: newAddress.toLowerCase(),
          chainId: targetHex
        }));
      }

      // Then emit chain changed event
      setTimeout(() => {
        webref.current?.injectJavaScript(`
          (function(){
            var p = Array.isArray(window.ethereum?.providers)
              ? window.ethereum.providers.find(x => x && x.providerId === '${PROVIDER_ID}')
              : (window.ethereum?.providerId === '${PROVIDER_ID}' ? window.ethereum : null);
            if (p) {
              try { 
                p._emitEvent('chainChanged', '${targetHex}'); 
                p._emitEvent('accountsChanged', ['${newAddress.toLowerCase()}']);
                console.log('[VP Provider] Chain switched to:', '${targetHex}', 'Address:', '${newAddress.toLowerCase()}');
              } catch(e){
                console.warn('[VP Provider] Failed to emit chain change:', e);
              }
            }
          })();
        `);
      }, 200);
    }

    logService.info('Switched chain', { from: ctx.chainId, to: targetNum, address: newAddress });
    return null;
  },

  /**
   * wallet_addEthereumChain - Add a custom chain (EIP-3085)
   */
  async wallet_addEthereumChain(params) {
    const { confirmDialog, t } = ctx;
    const chainData = params?.[0];

    if (!chainData?.chainId) {
      throw new Error('Missing chainId in chain data');
    }

    // For now, we only support predefined chains
    const targetHex = String(chainData.chainId).toLowerCase();
    if (!SUPPORTED_CHAINS[targetHex]) {
      throw new Error(`Chain ${targetHex} is not supported. Please contact support to add this chain.`);
    }

    // Chain already supported, just switch to it
    return await this.wallet_switchEthereumChain([{ chainId: targetHex }]);
  },
});
