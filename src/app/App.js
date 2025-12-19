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

function App() {
  const {colorScheme} = useSnapshot(appearanceStore);
  const snap = useSnapshot(snackbarStore);
  const isDarkMode = colorScheme === 'dark';
  const barStyle = isDarkMode ? 'light-content' : 'dark-content';
  useEffect(() => {
    tokenPriceStore.fetchAll();
    tokenRegistryStore.loadAll();
    localeStore.init();
    appearanceStore.init();
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
