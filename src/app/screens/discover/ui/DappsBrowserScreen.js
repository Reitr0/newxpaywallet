// src/features/browser/ui/DappsBrowserScreen.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import { Image, Keyboard, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VText from '@src/shared/ui/primitives/VText';
import VBack from '@src/shared/ui/primitives/VBack';

import { walletStore } from '@features/wallet/state/walletStore';
import { dappBrowserStore } from '@features/dapps/state/dappBrowserStore';
import { buildInjectedProviderScript } from '@features/dapps/service/injectedProvider';
import {
  HOME_BASE,
  PROVIDER_ID,
  PROVIDER_LOGO,
  PROVIDER_NAME,
  toHexChainId,
} from '@features/dapps/service/dappBrowserConfig';
import { makeDappRpcRouter } from '@features/dapps/service/dappRpcRouter';
import { jsEmit, jsResolve, jsSyncState } from '@features/dapps/service/injectionHelpers';
import { confirmDialog, setConfirmSheetRef } from '@features/dapps/service/confirmDialog';
import DappConfirmSheet from '@src/app/screens/discover/components/DappConfirmSheet';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';

export default function DappsBrowserScreen({ route }) {
  const { t } = useTranslation();
  const confirmRef = useRef(null);
  const webref = useRef(null);
  const s = useSnapshot(dappBrowserStore);
  const initialUrl = route?.params?.initialUrl;

  /* Inject provider */
  const INJECTED_PROVIDER = buildInjectedProviderScript({
    PROVIDER_ID,
    PROVIDER_NAME,
    PROVIDER_LOGO,
  });

  /* Active wallet info */
  const getActiveAddress = useCallback(() => {
    // Always sync wallet state when requested
    dappBrowserStore.syncWalletState();
    return s.activeAddress;
  }, [s.activeAddress]);

  const getActiveChainId = useCallback(() => {
    return s.activeChainId || 1;
  }, [s.activeChainId]);

  const routeRpc = makeDappRpcRouter({
    walletStore,
    webref,
    sitePermissions: dappBrowserStore.sitePermissions,
    toHexChainId,
    getActiveAddress,
    getActiveChainId,
    PROVIDER_ID,
    confirmDialog,
    t,
  });

  /* Handle provider messages */
  const onMessage = useCallback(
    async (e) => {
      let msg;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }

      if (msg?.type === 'vp_nav' && msg?.url) {
        webref.current?.loadUrl?.(msg.url);
        dappBrowserStore.setUrl(msg.url);
        return;
      }

      if (msg?.type !== 'provider_request') return;
      const { id, payload, origin } = msg;

      try {
        const result = await routeRpc(payload, { origin });
        webref.current?.injectJavaScript(jsResolve(id, true, result));
      } catch (err) {
        const rpcMethod = payload?.method || 'unknown_method';
        const errorMessage = err?.message || String(err) || t('errors.unknown', 'Unknown error');
        const errorObj = { code: 4001, message: errorMessage };
        webref.current?.injectJavaScript(jsResolve(id, false, errorObj));

        snackbarStore.show(errorMessage, 'error');
      }
    },
    [routeRpc, t]
  );

  /* Navigation and URL bar */
  const go = useCallback(() => {
    Keyboard.dismiss();
    let u = (s.url || '').trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    webref.current?.loadUrl?.(u);
    dappBrowserStore.toggleUrlInput();
  }, [s.url]);

  const goHome = useCallback(() => {
    dappBrowserStore.setUrl(HOME_BASE);
    webref.current?.loadUrl?.(HOME_BASE);
  }, []);

  const onNavChange = useCallback((st) => {
    dappBrowserStore.setNavState(st);
    if (st?.url) dappBrowserStore.setUrl(st.url);
  }, []);

  const onLoadStart = useCallback(() => {
    dappBrowserStore.setLoading(true);
  }, []);
  const onLoadProgress = useCallback((e) => {
    dappBrowserStore.setProgress(e?.nativeEvent?.progress ?? 0);
  }, []);
  const onLoadEnd = useCallback(() => {
    dappBrowserStore.setLoading(false);
    setTimeout(() => dappBrowserStore.setProgress(0), 150);

    // CRITICAL: Re-sync state after page load
    const addr = getActiveAddress();
    const chainId = getActiveChainId();

    if (addr && chainId) {
      const hexChainId = toHexChainId(chainId);

      console.log('[DApp Browser] Page loaded, re-syncing state:', { addr, chainId: hexChainId });

      // Re-inject state after page load with multiple attempts
      const syncAttempts = [500, 1000, 2000, 3000]; // Try multiple times

      syncAttempts.forEach((delay) => {
        setTimeout(() => {
          console.log(`[DApp Browser] Sync attempt at ${delay}ms`);

          // 1. Sync state
          webref.current?.injectJavaScript(jsSyncState({
            selectedAddress: addr,
            chainId: hexChainId
          }));

          // 2. Re-emit events
          setTimeout(() => {
            webref.current?.injectJavaScript(jsEmit('accountsChanged', [addr]));
            webref.current?.injectJavaScript(jsEmit('chainChanged', hexChainId));
            webref.current?.injectJavaScript(jsEmit('connect', { chainId: hexChainId }));

            // 3. Force provider to be "ready"
            webref.current?.injectJavaScript(`
              (function() {
                try {
                  if (window.ethereum) {
                    window.ethereum.selectedAddress = '${addr}';
                    window.ethereum.chainId = '${hexChainId}';
                    window.ethereum._isReady = true;
                    window.ethereum._initialized = true;
                    console.log('[VP Provider] Force ready:', window.ethereum.selectedAddress, window.ethereum.chainId);
                  }
                } catch(e) {
                  console.warn('[VP Provider] Force ready failed:', e);
                }
              })();
            `);
          }, 200);
        }, delay);
      });
    }
  }, [getActiveAddress, getActiveChainId]);

  /* Lifecycle */
  useEffect(() => {
    // CRITICAL: Set URL first before syncing wallet state
    dappBrowserStore.setInitialUrl(initialUrl);

    // THEN sync wallet state (so BSC detection works)
    dappBrowserStore.syncWalletState();

    const addr = getActiveAddress();
    const chainId = getActiveChainId();

    console.log('[DApp Browser] Initializing with wallet:', { addr, chainId, url: initialUrl });

    // CRITICAL: Auto-grant permission for trusted sites
    if (addr && s.shouldAutoConnect?.()) {
      const origin = dappBrowserStore.getOrigin(initialUrl);
      console.log('[DApp Browser] Auto-granting permission for:', origin);
      dappBrowserStore.sitePermissions.set(origin, {
        connected: true,
        address: addr
      });
    }

    // CRITICAL: Sync provider state first, then emit events
    if (addr && chainId) {
      const hexChainId = toHexChainId(chainId);

      console.log('[DApp Browser] Using chain:', { chainId, hexChainId, addr });

      // 1. Sync provider internal state
      const stateScript = jsSyncState({
        selectedAddress: addr,
        chainId: hexChainId
      });
      console.log('[DApp Browser] Syncing provider state:', stateScript);
      webref.current?.injectJavaScript(stateScript);

      // 2. Then emit events (with delay to ensure state is synced)
      setTimeout(() => {
        const accountScript = jsEmit('accountsChanged', [addr]);
        const chainScript = jsEmit('chainChanged', hexChainId);

        console.log('[DApp Browser] Injecting accountsChanged:', accountScript);
        console.log('[DApp Browser] Injecting chainChanged:', chainScript);

        webref.current?.injectJavaScript(accountScript);
        webref.current?.injectJavaScript(chainScript);

        // 3. Emit connect event
        const connectScript = jsEmit('connect', { chainId: hexChainId });
        console.log('[DApp Browser] Injecting connect event:', connectScript);
        webref.current?.injectJavaScript(connectScript);
      }, 500);
    }

    if (initialUrl === HOME_BASE) goHome();
  }, [getActiveAddress, getActiveChainId, goHome, initialUrl, s.shouldAutoConnect]);

  // Watch for wallet store changes and sync
  useEffect(() => {
    const interval = setInterval(() => {
      const prevAddress = s.activeAddress;
      dappBrowserStore.syncWalletState();

      // If address changed, notify DApp
      if (s.activeAddress !== prevAddress && s.activeAddress) {
        console.log('[DApp Browser] Address changed, notifying DApp:', s.activeAddress);

        // Sync state first
        webref.current?.injectJavaScript(jsSyncState({
          selectedAddress: s.activeAddress,
          chainId: s.activeChainHex
        }));

        // Then emit event
        setTimeout(() => {
          webref.current?.injectJavaScript(jsEmit('accountsChanged', [s.activeAddress]));
        }, 100);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [s.activeAddress, s.activeChainHex]);

  useEffect(() => {
    setConfirmSheetRef(confirmRef.current);
  }, []);

  /* Guard navigation */
  const guardRequest = useCallback((req) => {
    const allowed = /^https?:\/\//i.test(req.url) || req.url === HOME_BASE;
    if (!allowed) return false;

    if (req.navigationType === 'click' && req.mainDocumentURL && req.url !== req.mainDocumentURL) {
      webref.current?.loadUrl?.(req.url);
      return false;
    }

    if (req.hasOwnProperty('isTopFrame') && req.isTopFrame === false) {
      webref.current?.loadUrl?.(req.url);
      return false;
    }

    return true;
  }, []);

  return (
    <View className="flex-1 bg-app">
      {/* Top Bar */}
      <View className="pt-3 pb-2 px-3">
        <View className="flex-row items-center space-x-2">
          <VBack />

          <VPressable onPress={() => dappBrowserStore.toggleUrlInput()} className="flex-1">
            {s.showUrlInput ? (
              <View className="flex-row items-center px-3 rounded-2xl bg-black/5">
                <VIcon name="search" type="Feather" size={16} className="text-muted mr-2" />
                <TextInput
                  value={s.url}
                  onChangeText={(t) => dappBrowserStore.setUrl(t)}
                  onSubmitEditing={go}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder={t(
                    'dappBrowserScreen.searchPlaceholder',
                    'Search or enter URL'
                  )}
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 text-sm text-title"
                />
              </View>
            ) : (
              <View className="flex-row items-center px-3 py-2 rounded-2xl bg-black/5">
                {s.favicon ? (
                  <Image source={{ uri: s.favicon }} className="w-4 h-4 rounded mr-2" />
                ) : (
                  <VIcon name="globe" type="Feather" size={14} className="text-muted mr-2" />
                )}
                <VIcon
                  name={s.isSecure ? 'lock' : 'alert-circle'}
                  type="Feather"
                  size={14}
                  className={s.isSecure ? 'text-emerald-600 mr-2' : 'text-yellow-500 mr-2'}
                />
                <VText numberOfLines={1} className="flex-1 text-sm font-medium text-title">
                  {s.host || t('dappBrowserScreen.blankPage', 'about:blank')}
                </VText>
              </View>
            )}
          </VPressable>

          <VPressable
            className="w-8 items-end"
            onPress={() => snackbarStore.show(t('dappBrowserScreen.moreComing', 'More options coming soon'), 'info')}
          >
            <VIcon name="more-vertical" type="Feather" size={18} className="text-title" />
          </VPressable>
        </View>

        {/* Progress */}
        <View className="h-0.5 mt-2 overflow-hidden rounded">
          <View
            className="h-0.5 bg-blue-500"
            style={{ width: `${Math.round(s.progress * 100)}%` }}
          />
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={(r) => {
          webref.current = r;
        }}
        source={{ uri: initialUrl }}
        injectedJavaScriptBeforeContentLoaded={INJECTED_PROVIDER}
        injectedJavaScript={INJECTED_PROVIDER}
        onMessage={onMessage}
        onNavigationStateChange={onNavChange}
        setSupportMultipleWindows={false}
        onOpenWindow={({ nativeEvent }) => {
          const { targetUrl } = nativeEvent || {};
          if (targetUrl) webref.current?.loadUrl?.(targetUrl);
        }}
        onShouldStartLoadWithRequest={guardRequest}
        onLoadStart={onLoadStart}
        onLoadProgress={onLoadProgress}
        onLoadEnd={onLoadEnd}
        pullToRefreshEnabled
        userAgent="VPocketBrowser/1.0"
        originWhitelist={['https://*', 'http://*', HOME_BASE]}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        mixedContentMode="never"
        thirdPartyCookiesEnabled={false}
        mediaPlaybackRequiresUserAction
      />

      {/* Bottom Toolbar */}
      <View className="h-12 px-4 bg-item border-t border-border-subtle">
        <View className="flex-1 flex-row items-center justify-between">
          <VPressable disabled={!s.canGoBack} onPress={() => webref.current?.goBack?.()}>
            <VIcon
              name="chevron-left"
              type="Feather"
              size={20}
              className={s.canGoBack ? 'text-title' : 'text-muted'}
            />
          </VPressable>

          <VPressable disabled={!s.canGoForward} onPress={() => webref.current?.goForward?.()}>
            <VIcon
              name="chevron-right"
              type="Feather"
              size={20}
              className={s.canGoForward ? 'text-title' : 'text-muted'}
            />
          </VPressable>

          <VPressable onPress={() => dappBrowserStore.toggleFav()}>
            <VIcon
              name="heart"
              type="Feather"
              size={20}
              className={s.favs.has(s.host) ? 'text-rose-500' : 'text-muted'}
            />
          </VPressable>

          <VPressable onPress={() => webref.current?.reload?.()}>
            <VIcon name="refresh-cw" type="Feather" size={20} className="text-title" />
          </VPressable>
        </View>
      </View>

      <DappConfirmSheet ref={confirmRef} />
    </View>
  );
}
