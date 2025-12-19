// src/app/navigation/AppStack.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import BottomTabs from '@src/app/navigation/BottomTabs';
import ManageCryptoScreen from '@src/app/screens/token/ManageCryptoScreen';
import { useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';
import LockScreen from '@src/app/screens/auth/ui/LockScreen';
import WalletDetailScreen from '@src/app/screens/wallet/ui/WalletDetailScreen';
import WalletSendScreen from '@src/app/screens/wallet/ui/WalletSendScreen';
import WalletReceiveScreen from '@src/app/screens/wallet/ui/WalletReceiveScreen';
import WalletExchangeScreen from '@src/app/screens/wallet/ui/WalletExchangeScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import DappsBrowserScreen from '@src/app/screens/discover/ui/DappsBrowserScreen';
import AccountScreen from '@src/app/screens/setting/ui/AccountScreen';
import ExportMnemonicScreen from '@src/app/screens/setting/ui/ExportMnemonicScreen';
import PreferencesScreen from '@src/app/screens/setting/ui/PreferencesScreen';
import SecurityScreen from '@src/app/screens/setting/ui/SecurityScreen';
import MarketDetailScreen from '@src/app/screens/trending/ui/MarketDetailScreen';
import WalletsScreen from '@src/app/screens/wallet/ui/WalletsScreen';
import WalletTxDetailScreen from '@src/app/screens/wallet/ui/WalletTxDetailScreen';

import { authStore, shouldShowLockScreen } from '@src/features/auth/state/authStore';

const Stack = createStackNavigator();

export default function AppStack() {
  const navigation = useNavigation();

  // Avoid double-pushing lock screen
  const lockingRef = useRef(false);

  const goToLockScreen = useCallback(() => {
    if (lockingRef.current) return;
    lockingRef.current = true;
    navigation.navigate('AppLockScreen', {
      mode: 'lock',
      showHeader: false,
      onCallBack: () => {
        // after successful unlock, pop this screen
        lockingRef.current = false;
        navigation.goBack();
      },
    });
  }, [navigation]);

  const handleAppStateChange = useCallback(async (nextState) => {
    // Treat inactive like background on iOS
    if (nextState === 'background' || nextState === 'inactive') {
      authStore.markBackground(); // records timestamp for auto-lock
      return;
    }

    if (nextState === 'active') {
      // Update lock state based on elapsed time + user presets
      authStore.maybeAutoLockOnResume();

      // If policy says we should lock, present lock screen
      if (shouldShowLockScreen()) {
        goToLockScreen();
      }
    }
  }, [goToLockScreen]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [handleAppStateChange]);

  return (
    <SafeAreaView className="flex-1 bg-app">
      <Stack.Navigator
        id="AppStack"
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        <Stack.Screen name="BottomTabs" component={BottomTabs} />
        <Stack.Screen name="ManageCrypto" component={ManageCryptoScreen} />
        <Stack.Screen name="AppLockScreen" component={LockScreen} />
        <Stack.Screen name="WalletDetailScreen" component={WalletDetailScreen} />
        <Stack.Screen name="WalletSendScreen" component={WalletSendScreen} />
        <Stack.Screen name="WalletReceiveScreen" component={WalletReceiveScreen} />
        <Stack.Screen name="WalletExchangeScreen" component={WalletExchangeScreen} />
        <Stack.Screen name="DappsBrowserScreen" component={DappsBrowserScreen} />
        <Stack.Screen name="AccountScreen" component={AccountScreen} />
        <Stack.Screen name="ExportMnemonicScreen" component={ExportMnemonicScreen} />
        <Stack.Screen name="PreferencesScreen" component={PreferencesScreen} />
        <Stack.Screen name="SecurityScreen" component={SecurityScreen} />
        <Stack.Screen name="MarketDetailScreen" component={MarketDetailScreen} />
        <Stack.Screen name="WalletsScreen" component={WalletsScreen} />
        <Stack.Screen name="WalletTxDetailScreen" component={WalletTxDetailScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
}
