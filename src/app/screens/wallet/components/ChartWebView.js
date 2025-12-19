import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const HOST = 'vprice-68e717fd25a6.herokuapp.com';

const ChartWebView = React.memo(function ChartWebView({ pair, colorScheme, className }) {
  const webRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const uri = useMemo(() => {
    const qp =
      'pair=' + encodeURIComponent(pair || '') +
      '&theme=' + encodeURIComponent(colorScheme || 'light');

    return `https://${HOST}/chart?${qp}`;
  }, [pair, colorScheme]);
  const source = useMemo(() => ({ uri, headers: { Accept: 'text/html' } }), [uri]);

  const onShouldStart = useCallback((req) => {
    try {
      const url = new URL(req.url);
      return url.host === HOST;
    } catch {
      return false;
    }
  }, []);

  const onReload = useCallback(() => {
    setFailed(false);
    setLoading(true);
    if (webRef.current) webRef.current.reload();
  }, []);

  return (
    <View className={className || 'flex-1'}>
      {loading && !failed && (
        <View className="absolute inset-0 items-center justify-center z-10">
          <ActivityIndicator size="small" />
        </View>
      )}

      {failed ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base mb-3">Couldn’t load the chart.</Text>
          <Pressable onPress={onReload} className="px-4 py-2 rounded-2xl bg-black/10 dark:bg-white/10">
            <Text>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webRef}
          originWhitelist={['https://*']}
          source={source}
          // Performance
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
          overScrollMode="never"
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          textZoom={100}
          // Security
          onShouldStartLoadWithRequest={onShouldStart}
          // Lifecycle
          startInLoadingState
          onLoadStart={() => { setLoading(true); setFailed(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
          // Nice-to-haves
          allowsInlineMediaPlayback
          applicationNameForUserAgent="VPocket/ChartWebView"
          pullToRefreshEnabled={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          injectedJavaScriptBeforeContentLoaded={`
            try {
              document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
            } catch(e) {}
            true;
          `}
        />
      )}
    </View>
  );
});

export default ChartWebView;
