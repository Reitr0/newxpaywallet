// src/features/browser/services/rpcHandlers/accountHandlers.js
export const accountHandlers = (ctx) => ({
  /**
   * eth_accounts
   */
  async eth_accounts() {
    const { sitePermissions, origin, activeAddr } = ctx;
    
    console.log('[Account Handler] eth_accounts called', { origin, activeAddr });
    
    const perm = sitePermissions.get(origin);
    console.log('[Account Handler] Current permission:', perm);
    
    // If site has permission, return address
    if (perm?.connected && perm?.address) {
      console.log('[Account Handler] ✅ eth_accounts returning connected address:', perm.address);
      return [perm.address];
    }
    
    // For auto-connect sites, return address immediately
    try {
      const host = new URL(origin).hostname;
      const shouldAutoConnect = host.includes('solxdapp') || 
                               host.includes('pancake') || 
                               host.includes('uniswap') ||
                               host.includes('bsc');
      
      console.log('[Account Handler] Auto-connect check:', { host, shouldAutoConnect, activeAddr });
      
      if (shouldAutoConnect && activeAddr) {
        console.log('[Account Handler] ✅ eth_accounts auto-returning address for trusted site:', activeAddr);
        // Auto-grant permission
        sitePermissions.set(origin, { connected: true, address: activeAddr });
        return [activeAddr];
      }
    } catch (e) {
      console.warn('[Account Handler] Failed to parse origin:', e);
    }
    
    console.log('[Account Handler] ⚠️ eth_accounts returning empty (not connected)');
    return [];
  },

  /**
   * eth_requestAccounts
   */
  async eth_requestAccounts() {
    const {
      confirmDialog,
      activeAddr,
      sitePermissions,
      origin,
      chainId,
      toHexChainId,
      webref,
      jsEmit,
      jsSyncState,
      t, // ✅ i18n translator passed from context
    } = ctx;

    if (!activeAddr) throw new Error(t('errors.noActiveWallet', 'No active wallet'));

    const existing = sitePermissions.get(origin);
    if (existing?.connected && existing?.address) {
      // Already connected, just sync state and return
      const hex = toHexChainId(chainId);
      if (webref?.current && jsSyncState) {
        webref.current.injectJavaScript(jsSyncState({
          selectedAddress: activeAddr,
          chainId: hex
        }));
      }
      return [existing.address];
    }

    const ok = await confirmDialog(
      t('dapp.connectWalletTitle', 'Connect Wallet'),
      t('dapp.connectWalletMessage', {
        defaultValue: 'Allow this site to view your address?\n\n{{short}}',
        short: `${activeAddr.slice(0, 6)}…${activeAddr.slice(-4)}`,
      }),
      {
        variant: 'connect',
        confirmText: t('common.connect', 'Connect'),
      }
    );
    if (!ok) throw new Error(t('errors.userRejected', 'User rejected'));

    sitePermissions.set(origin, { connected: true, address: activeAddr });

    const hex = toHexChainId(chainId);
    
    // CRITICAL: Sync state first, then emit events
    if (webref?.current) {
      if (jsSyncState) {
        webref.current.injectJavaScript(jsSyncState({
          selectedAddress: activeAddr,
          chainId: hex
        }));
      }
      
      // Then emit events with delay
      setTimeout(() => {
        webref.current?.injectJavaScript(jsEmit('accountsChanged', [activeAddr]));
        webref.current?.injectJavaScript(jsEmit('connect', { chainId: hex }));
      }, 200);
    }

    return [activeAddr];
  },

  /**
   * wallet_requestPermissions
   */
  async wallet_requestPermissions() {
    const { activeAddr, origin, sitePermissions, confirmDialog, t } = ctx;
    if (!activeAddr) throw new Error(t('errors.noActiveWallet'));

    const existing = sitePermissions.get(origin);
    if (!existing?.connected) {
      // show connect dialog only first time
      const ok = await confirmDialog(
        t('dapp.connectWalletTitle'),
        t('dapp.connectWalletMessage', {
          short: `${activeAddr.slice(0, 6)}…${activeAddr.slice(-4)}`,
        }),
        { variant: 'connect', confirmText: t('common.connect') }
      );
      if (!ok) throw new Error(t('errors.userRejected'));
    }

    sitePermissions.set(origin, { connected: true, address: activeAddr });

    const now = Date.now();
    return [
      {
        id: String(now),
        invoker: origin,
        parentCapability: 'eth_accounts',
        caveats: [{ type: 'restrictReturnedAccounts', value: [activeAddr] }],
        date: now,
      },
    ];
  },

  /**
   * wallet_getPermissions
   */
  async wallet_getPermissions() {
    const { perm, activeAddr, origin } = ctx;
    const now = Date.now();
    const addr = perm?.address || activeAddr;
    return [
      {
        id: String(now),
        invoker: origin,
        parentCapability: 'eth_accounts',
        caveats: [{ type: 'restrictReturnedAccounts', value: [addr] }],
        date: now,
      },
    ];
  },

  async wallet_revokePermissions() {
    const { origin, sitePermissions, confirmDialog, t } = ctx;

    const perm = sitePermissions.get(origin);
    if (!perm?.connected) throw new Error(t('dapp.notConnected', 'This site has no active permissions'));

    const ok = await confirmDialog(
      t('dapp.disconnectSiteTitle', 'Disconnect DApp'),
      t('dapp.disconnectSiteMessage', {
        site: origin,
      }),
      { variant: 'warning', confirmText: t('common.disconnect', 'Disconnect') }
    );

    if (!ok) throw new Error(t('errors.userRejected', 'User rejected'));

    // remove permission
    sitePermissions.delete(origin);

    return true;
  },

  async wallet_revokeAllPermissions() {
    const { sitePermissions, confirmDialog, t } = ctx;

    const ok = await confirmDialog(
      t('dapp.disconnectAllTitle', 'Disconnect All DApps'),
      t('dapp.disconnectAllMessage', 'This will remove all connected sites. Continue?'),
      { variant: 'danger', confirmText: t('common.disconnectAll', 'Disconnect All') }
    );

    if (!ok) throw new Error(t('errors.userRejected', 'User rejected'));

    sitePermissions.clear();

    return true;
  },
  /**
   * wallet_getCapabilities (non-standard / MetaMask experimental)
   * Return a static map of supported capabilities without prompting the user.
   * Safe to call before connection.
   */
  async wallet_getCapabilities() {
    const { walletStore, chainId, t } = ctx;

    // Basic feature probes (so the response mirrors what your wallet can do)
    const canPersonalSign     = typeof walletStore.signPersonalMessage === 'function';
    const canTypedDataV4      = typeof walletStore.signTypedDataV4 === 'function';
    const canSendTx           = typeof walletStore.sendTransaction === 'function' || typeof walletStore.sendDappsTransaction === 'function';
    const canCall             = typeof walletStore.call === 'function';
    const canEstimateGas      = typeof walletStore.estimateGas === 'function';
    const canSwitchChain      = typeof walletStore.switchChain === 'function';
    const canAddCustomChain   = typeof walletStore.addCustomChain === 'function';
    const canWatchAsset       = typeof walletStore.addWatchedToken === 'function';

    // Optional: reflect which chains are supported (if your store exposes it)
    const supportedChains =  walletStore.instances ? Object.keys(walletStore.instances) : null;

    // Keep it simple & JSON-serializable
    return {
      wallet: {
        name: t?.('wallet.name', 'VPocket') || 'VPocket',
        version: '1.0',
        chainId, // current active chain id in your app
      },

      // Capabilities map — keys resemble methods DApps may probe
      capabilities: {
        eth_accounts: {
          supported: true,
          description: t?.('cap.eth_accounts', 'Read the user’s public address'),
        },
        personal_sign: {
          supported: canPersonalSign,
          description: t?.('cap.personal_sign', 'Sign arbitrary messages (EIP-191)'),
        },
        eth_signTypedData_v4: {
          supported: canTypedDataV4,
          description: t?.('cap.eip712', 'Sign structured data (EIP-712 v4)'),
        },
        eth_sendTransaction: {
          supported: canSendTx,
          description: t?.('cap.send_tx', 'Create & send transactions'),
        },
        eth_call: {
          supported: canCall,
          description: t?.('cap.eth_call', 'Read-only contract calls'),
        },
        eth_estimateGas: {
          supported: canEstimateGas,
          description: t?.('cap.estimate_gas', 'Estimate gas for a transaction'),
        },
        wallet_switchEthereumChain: {
          supported: canSwitchChain,
          description: t?.('cap.switch_chain', 'Switch the active EVM network'),
          chains: supportedChains, // e.g., ["1","56","137"] if available
        },
        wallet_addEthereumChain: {
          supported: canAddCustomChain,
          description: t?.('cap.add_chain', 'Add a custom EVM network'),
        },
        wallet_getPermissions: {
          supported: true,
          description: t?.('cap.get_perms', 'List granted permissions for this site'),
        },
        wallet_requestPermissions: {
          supported: true,
          description: t?.('cap.req_perms', 'Request permissions (e.g., accounts)'),
        },
        wallet_watchAsset: {
          supported: canWatchAsset,
          description: t?.('cap.watch_asset', 'Request wallet to watch a token'),
        },
      },
    };
  },
});
