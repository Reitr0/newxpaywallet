import React from 'react';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import StartScreen from '@src/app/screens/auth/ui/StartScreen';
import LockScreen from '@src/app/screens/auth/ui/LockScreen';
import AgreementScreen from '@src/app/screens/auth/ui/AgreementScreen';
import MnemonicScreen from '@src/app/screens/auth/ui/MnemonicScreen';
import ConfirmMnemonicScreen from '@src/app/screens/auth/ui/ConfirmMnemonicScreen';
import ImportMnemonicScreen from '@src/app/screens/auth/ui/ImportMnemonicScreen';
import { authStore } from '@src/features/auth/state/authStore';
import { useSnapshot } from 'valtio';
import { walletStore } from '@features/wallet/state/walletStore';
import { SafeAreaView } from 'react-native-safe-area-context';


const Stack = createStackNavigator();

export default function AuthStack() {
  const {hasWallet} = useSnapshot(authStore);
  return (
    <SafeAreaView className={'flex-1 bg-app'}>
    <Stack.Navigator id={'AuthStack'} s
                     screenOptions={{
                       headerShown: false,
                       cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS
                     }}
    >
      {hasWallet && (
        <Stack.Screen
          name="LockScreen"
          component={LockScreen}
          initialParams={{
            onCallBack: () => {
              walletStore.init().then(()=>{
                authStore.setAuthenticated(true);
                authStore.unlock?.();
              });
            },
            showHeader: false,
            mode: 'enter',
          }}
          options={{headerShown: false}}
        />
      )}
      {
        !hasWallet && (
          <>
            <Stack.Screen name="StartScreen" component={StartScreen} />
            <Stack.Screen name="LockScreen" component={LockScreen}  />
            <Stack.Screen name="AgreementScreen" component={AgreementScreen}  />
            <Stack.Screen name="MnemonicScreen" component={MnemonicScreen}  />
            <Stack.Screen name="ConfirmMnemonicScreen" component={ConfirmMnemonicScreen}  />
            <Stack.Screen name="ImportMnemonicScreen" component={ImportMnemonicScreen}  />
          </>
        )
      }
    </Stack.Navigator>
    </SafeAreaView>
  );
}
