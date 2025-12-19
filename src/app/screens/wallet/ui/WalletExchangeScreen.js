// src/pages/buySell/ui/TransfiScreen.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Platform, View, } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import VBack from '@src/shared/ui/primitives/VBack';

const TRANSFI_BASE = 'https://buy.transfi.com/';
const API_KEY = 'tzwD1nmhh8ItKzqN';
const ALLOWED_HOSTS = new Set(['buy.transfi.com', 'transfi.com', 'www.transfi.com']);

export default function WalletExchangeScreen({ route }) {
  const insets = useSafeAreaInsets();
  const webRef = useRef(null);

  const {
    cryptoNetwork = 'Bitcoin',
    cryptoTicker = 'BTC',
    walletAddress,
    view = 'buy',           // 'buy' | 'sell'
    country = 'VN',
    fiatTicker = 'VND',
    fiatAmount,             // optional
    paymentCode,            // optional
    partnerContext,         // optional
  } = route?.params || {};

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Stable URL builder (keeps param order, avoids accidental reloads)
  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('apiKey', API_KEY);
    params.set('view', view);
    params.set('country', country);
    params.set('cryptoNetwork', cryptoNetwork);
    params.set('cryptoTicker', cryptoTicker);
    params.set('fiatTicker', fiatTicker);
    if (walletAddress) params.set('walletAddress', walletAddress);
    if (fiatAmount != null) params.set('fiatAmount', String(fiatAmount));
    if (partnerContext) params.set('partnerContext', partnerContext);
    if (paymentCode) params.set('paymentCode', paymentCode);
    return `${TRANSFI_BASE}?${params.toString()}`;
  }, [view, country, cryptoNetwork, cryptoTicker, fiatTicker, fiatAmount, partnerContext, paymentCode, walletAddress]);
  console.log(url)
  // Keep track of internal history for Android back
  const onNavChange = useCallback((s) => {
    if (webRef.current) webRef.current.canGoBack = s.canGoBack;
    // Example success/exit handling:
    // if (s.url.includes('status=success')) { /* show toast, navigate back, etc. */ }
  }, []);

  // Intercept external navigations (keep user inside TransFi)
  const onShouldStart = useCallback((req) => {
    let host = '';
    try { host = new URL(req.url).hostname; } catch {}
    const allow = ALLOWED_HOSTS.has(host);
    if (allow) return true;
    // Open any out-of-domain links in the system browser
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  return (
    <View className="flex-1 bg-app -mt-4">
      <WebView
        ref={webRef}
        source={{ uri: url, headers: { Accept: 'text/html' } }}
        originWhitelist={['https://*']}                 // keep strict
        onNavigationStateChange={onNavChange}
        onShouldStartLoadWithRequest={onShouldStart}
        // Lifecycle
        startInLoadingState
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
        onHttpError={() => { setLoading(false); setFailed(true); }}
        // Performance & rendering
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"                        // Android
        androidLayerType="hardware"                    // Android HW accel
        overScrollMode="never"                         // Android
        textZoom={100}                                 // Android consistency
        decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        // Security & misc
        setSupportMultipleWindows={false}              // avoid popups
        allowsBackForwardNavigationGestures            // iOS swipe
        allowsInlineMediaPlayback
        applicationNameForUserAgent="VPocket/TransFi"
        pullToRefreshEnabled={false}
        // Disable accidental pinch/double-tap zoom jank
        injectedJavaScriptBeforeContentLoaded={`
          try {
            document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
          } catch(e) {}
          true;
        `}
      />
      {/* Floating back button (safe-area aware) */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 z-20"
        style={{ top: insets.top + 3 }}
      >
        <View className="w-20 px-2">
          <VBack accessibilityLabel="Back" />
        </View>
      </View>
    </View>
  );
}
