import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '@src/shared/lib/i18n/i18n';
import ThemeProvider from '@src/app/providers/themeProvider';
import { I18nextProvider } from 'react-i18next';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import NavigationRoot from '@src/app/navigation/NavigationRoot';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useSnapshot } from 'valtio';
import { appearanceStore } from '@features/settings/appearance/state/appearanceStore';
import { tokenPriceStore } from '@features/tokens/price/state/tokenPriceStore';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';
import VSnackbar from '@src/shared/ui/primitives/VSnackbar';
import { tokenRegistryStore } from '@features/tokens/registry/state/tokenRegistryStore';
import { localeStore } from '@features/settings/locale/state/localeStore';
import { dappBrowserStore } from '@features/dapps/state/dappBrowserStore';
import { transactionMonitorService } from '@features/notifications/service/transactionMonitorService';
import { pushNotificationService } from '@features/notifications/service/pushNotificationService';
import { walletStore } from '@features/wallet/state/walletStore';

function App() {
  const {colorScheme} = useSnapshot(appearanceStore);
  const snap = useSnapshot(snackbarStore);
  const isDarkMode = colorScheme === 'dark';
  const barStyle = isDarkMode ? 'light-content' : 'dark-content';
  useEffect(() => {
    console.log('[App] 🚀 useEffect started - initializing app...');
    
    // Fetch prices with retry
    const fetchPrices = async () => {
      try {
        await tokenPriceStore.fetchAll();
        console.log('[App] Prices fetched successfully, count:', Object.keys(tokenPriceStore.prices).length);
      } catch (e) {
        console.warn('[App] Failed to fetch prices, retrying in 5s:', e.message);
        // Retry after 5 seconds
        setTimeout(fetchPrices, 5000);
      }
    };
    
    fetchPrices();
    tokenRegistryStore.loadAll();
    localeStore.init();
    appearanceStore.init();
    
    // Initialize DApp browser store with wallet state
    setTimeout(() => {
      dappBrowserStore.syncWalletState();
    }, 1000); // Wait for wallet to initialize
    
    // Initialize push notifications
    pushNotificationService.initialize().then(async () => {
      console.log('[App] Push notifications initialized');
    }).catch(err => {
      console.error('[App] Failed to initialize push notifications:', err);
    });
    
    // Initialize transaction monitoring - wait longer for wallets to load
    const startMonitoring = () => {
      console.log('[App] 🔔 Attempting to start transaction monitoring...');
      const allAssets = walletStore.assets || [];
      console.log('[App] 🔔 Total assets available:', allAssets.length);
      
      // Debug: Log all Solana assets
      const solanaAssets = allAssets.filter(a => a.chain === 'solana');
      console.log('[App] 🔔 Solana assets:', solanaAssets.length);
      solanaAssets.forEach(a => {
        console.log(`[App] 🔔   - ${a.symbol}:`, {
          isToken: a.isToken,
          hasAddress: !!a.address,
          hasTokenAddress: !!a.tokenAddress,
          address: a.address ? a.address.slice(0, 8) + '...' : 'NONE',
          tokenAddress: a.tokenAddress ? a.tokenAddress.slice(0, 8) + '...' : 'NONE',
        });
      });
      
      // Filter to get wallets that have actual wallet addresses (native + tokens with balance)
      // Include both native wallets and token wallets
      const walletsToMonitor = allAssets.filter(asset => {
        // Native wallets always have address
        if (!asset.isToken && asset.address) return true;
        
        // Token wallets: must have both wallet address AND token address
        if (asset.isToken && asset.address && asset.tokenAddress) {
          console.log('[App] 🔔 Token wallet found:', {
            symbol: asset.symbol,
            walletAddr: asset.address.slice(0, 8) + '...',
            tokenAddr: asset.tokenAddress.slice(0, 8) + '...',
          });
          return true;
        }
        
        return false;
      });
      
      console.log('[App] 🔔 Wallets to monitor:', walletsToMonitor.length);
      console.log('[App] 🔔 Native wallets:', walletsToMonitor.filter(w => !w.isToken).length);
      console.log('[App] 🔔 Token wallets:', walletsToMonitor.filter(w => w.isToken).length);
      
      if (walletsToMonitor.length > 0) {
        console.log('[App] 🔔 Starting monitoring with walletStore...');
        transactionMonitorService.startMonitoring(walletsToMonitor, walletStore);
        console.log('[App] 🔔 ✅ Transaction monitoring initialized with', walletsToMonitor.length, 'wallets');
      } else {
        console.warn('[App] ⚠️ No wallets yet, retrying in 2s...');
        setTimeout(startMonitoring, 2000); // Retry after 2 seconds
      }
    };
    
    // Start after 5 seconds to give wallet time to load
    setTimeout(startMonitoring, 5000);
    
    // Refresh prices every 60 seconds
    const priceInterval = setInterval(() => {
      tokenPriceStore.fetchAll().catch(e => {
        console.warn('[App] Price refresh failed:', e.message);
      });
    }, 60000);
    
    return () => {
      clearInterval(priceInterval);
      transactionMonitorService.stopMonitoring();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <NavigationContainer theme={ isDarkMode ? DarkTheme : DefaultTheme}>
          <StatusBar barStyle={barStyle} />
          <ThemeProvider name={'default'}>
            <I18nextProvider i18n={i18n}>
              <BottomSheetModalProvider>
                <NavigationRoot />
                <VSnackbar
                  visible={snap.visible}
                  message={snap.message}
                  type={snap.type}
                  onHide={() => snackbarStore.hide()}
                />
              </BottomSheetModalProvider>
            </I18nextProvider>
          </ThemeProvider>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default App;
