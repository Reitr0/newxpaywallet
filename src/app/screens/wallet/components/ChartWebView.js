import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const HOST = 'vprice-68e717fd25a6.herokuapp.com';

const ChartWebView = React.memo(function ChartWebView({ pair, colorScheme, className, tokenLogo, tokenSymbol, onChartFailed }) {
  const webRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const mountedRef = useRef(true);
  const failedNotifiedRef = useRef(false);

  // Helper to notify parent when chart fails
  const notifyFailed = useCallback(() => {
    if (!failedNotifiedRef.current && onChartFailed) {
      failedNotifiedRef.current = true;
      onChartFailed();
    }
  }, [onChartFailed]);

  const uri = useMemo(() => {
    const qp =
      'pair=' + encodeURIComponent(pair || '') +
      '&theme=' + encodeURIComponent(colorScheme || 'light');
    return `https://${HOST}/chart?${qp}`;
  }, [pair, colorScheme]);
  
  const source = useMemo(() => ({ uri, headers: { Accept: 'text/html' } }), [uri]);

  // Timeout: if chart doesn't become ready in 5 seconds, show fallback
  useEffect(() => {
    mountedRef.current = true;
    failedNotifiedRef.current = false;
    const timeout = setTimeout(() => {
      if (mountedRef.current && !chartReady) {
        setFailed(true);
        setLoading(false);
        notifyFailed();
      }
    }, 5000);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
    };
  }, [pair, chartReady, notifyFailed]); // Reset on pair change

  const onShouldStart = useCallback((req) => {
    try {
      const url = new URL(req.url);
      return url.host === HOST || url.host.includes('tradingview');
    } catch {
      return false;
    }
  }, []);

  const onReload = useCallback(() => {
    setFailed(false);
    setLoading(true);
    setChartReady(false);
    if (webRef.current) webRef.current.reload();
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'chartReady') {
        setChartReady(true);
        setLoading(false);
      } else if (data.type === 'chartError' || data.type === 'herokuError') {
        setFailed(true);
        setLoading(false);
        notifyFailed();
      }
    } catch {}
  }, [notifyFailed]);

  // Fallback view with token logo
  const FallbackView = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      {tokenLogo ? (
        <Image 
          source={{ uri: tokenLogo }} 
          style={{ width: 64, height: 64, borderRadius: 32 }}
          resizeMode="contain"
        />
      ) : (
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, color: '#fff', fontWeight: 'bold' }}>{tokenSymbol?.slice(0, 1) || '?'}</Text>
        </View>
      )}
      <Pressable onPress={onReload} style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)' }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>Retry</Text>
      </Pressable>
    </View>
  );

  const injectedJS = `
    (function() {
      try {
        // Check for Heroku error page
        var bodyText = document.body ? document.body.innerText : '';
        var title = document.title || '';
        if (bodyText.includes('Heroku') || 
            bodyText.includes('Application error') ||
            bodyText.includes('nothing here') ||
            bodyText.includes('Build something amazing') ||
            title.includes('Heroku')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'herokuError' }));
        } else {
          // Chart loaded successfully
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chartReady' }));
        }
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chartError', error: e.message }));
      }
    })();
    true;
  `;

  return (
    <View className={className || 'flex-1'}>
      {loading && !failed && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}

      {failed ? (
        <FallbackView />
      ) : (
        <WebView
          ref={webRef}
          originWhitelist={['https://*']}
          source={source}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
          overScrollMode="never"
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          textZoom={100}
          onShouldStartLoadWithRequest={onShouldStart}
          startInLoadingState
          onLoadStart={() => { setLoading(true); }}
          onLoadEnd={() => { /* Wait for injectedJS to confirm */ }}
          onError={() => { setLoading(false); setFailed(true); notifyFailed(); }}
          onHttpError={() => { setLoading(false); setFailed(true); notifyFailed(); }}
          onMessage={handleMessage}
          injectedJavaScript={injectedJS}
          allowsInlineMediaPlayback
          applicationNameForUserAgent="VPocket/ChartWebView"
          pullToRefreshEnabled={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        />
      )}
    </View>
  );
});

export default ChartWebView;
