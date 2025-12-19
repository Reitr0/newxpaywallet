import React, { useMemo, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VSpinner from '@src/shared/ui/primitives/VSpinner';
import VBack from '@src/shared/ui/primitives/VBack';
import { Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
/**
 * Route params:
 *  - url?: string                 // direct explorer URL
 *  - tx?: { hash?: string, explorerUrl?: string, ... } // normalized tx (optional)
 *  - title?: string               // optional custom title
 */
export default function WalletTxDetailScreen({ navigation, route }) {
  const { url: propUrl, tx, title: propTitle } = route.params || {};
  const url = propUrl || tx?.explorerUrl || null;

  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const title = propTitle || 'Transaction';
  const displayUrl = useMemo(() => {
    if (!url) return '';
    try {
      const u = new URL(url);
      return `${u.hostname}${u.pathname}`;
    } catch {
      return url;
    }
  }, [url]);

  const source = useMemo(() => (url ? { uri: url } : null), [url]);

  const onNavStateChange = (nav) => {
    setCanGoBack(!!nav.canGoBack);
    setCanGoForward(!!nav.canGoForward);
  };

  const openExternal = () => url && Linking.openURL(url).catch(() => {});
  const copyUrl = async () => { if (url) await Clipboard.setString(url); };
  const reload = () => webRef.current?.reload?.();
  const goBack = () => webRef.current?.goBack?.();
  const goForward = () => webRef.current?.goForward?.();

  return (
    <View className="flex-1 bg-app">
      {/* Top bar */}
      <View className="px-2 py-2 flex-row items-center border-b border-border-subtle">
        <View className="w-10">
          <VBack onPress={() => navigation.goBack()} />
        </View>

        <View className="flex-1">
          <VText className="text-title font-semibold" numberOfLines={1}>
            {title}
          </VText>
          {!!displayUrl && (
            <VText className="text-2xs text-muted" numberOfLines={1}>
              {displayUrl}
            </VText>
          )}
        </View>

        <View className="flex-row items-center">
          <ToolbarIcon icon="corner-up-left" onPress={goBack} disabled={!canGoBack} />
          <ToolbarIcon icon="corner-up-right" onPress={goForward} disabled={!canGoForward} />
          <ToolbarIcon icon="rotate-cw" onPress={reload} />
          <ToolbarIcon icon="clipboard" onPress={copyUrl} />
          <ToolbarIcon icon="external-link" onPress={openExternal} />
        </View>
      </View>

      {/* Thin progress bar */}
      {loading && (
        <View className="h-0.5 bg-border-subtle">
          <View
            style={{ width: `${Math.max(5, Math.floor(progress * 100))}%` }}
            className="h-0.5 bg-title"
          />
        </View>
      )}

      {/* WebView area */}
      <View className="flex-1 bg-app">
        {!source ? (
          <View className="flex-1 items-center justify-center px-4">
            <VText className="text-2xs text-muted">No explorer URL provided.</VText>
          </View>
        ) : (
          <>
            {loading && (
              <View className="absolute z-10 top-2 left-0 right-0 items-center">
                <VSpinner />
              </View>
            )}
            <WebView
              ref={webRef}
              source={source}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress ?? 0)}
              onNavigationStateChange={onNavStateChange}
              startInLoadingState={false}
              // Performance-focused flags
              cacheEnabled
              incognito={false}
              javaScriptEnabled
              domStorageEnabled
              allowsBackForwardNavigationGestures
              setSupportMultipleWindows={false}
              sharedCookiesEnabled
              decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.985}
              applicationNameForUserAgent="VCoinWallet"
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
            />
          </>
        )}
      </View>

      {/* Footer hash (optional) */}
      {tx?.hash && (
        <View className="px-3 py-2 border-t border-border-subtle">
          <VText className="text-2xs text-muted" numberOfLines={1}>
            {tx.hash}
          </VText>
        </View>
      )}
    </View>
  );
}

function ToolbarIcon({ icon, onPress, disabled }) {
  return (
    <VPressable
      onPress={onPress}
      disabled={disabled}
      className={`px-2 py-1 ${disabled ? 'opacity-40' : ''}`}
      accessibilityRole="button"
    >
      <VIcon type="Feather" name={icon} size={18} className="text-title" />
    </VPressable>
  );
}
