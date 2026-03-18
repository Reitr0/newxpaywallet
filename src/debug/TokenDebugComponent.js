// Debug component to force reload tokens
// Add this to your app temporarily for debugging

import React from 'react';
import { View, Alert } from 'react-native';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import { walletRegistryService } from '@features/wallet/service/walletRegistryService';
import { walletStore } from '@features/wallet/state/walletStore';

// Try to import notifee with proper default import
let pushNotificationService = null;
let notifeeModule = null;
let notifeeAvailable = false;

try {
  // Use default import for notifee
  notifeeModule = require('@notifee/react-native').default;
  console.log('✅ @notifee/react-native loaded successfully');
  console.log('   Notifee type:', typeof notifeeModule);
  console.log('   Available methods:', Object.keys(notifeeModule).slice(0, 10).join(', '));

  pushNotificationService = require('@features/notifications/service/pushNotificationService').pushNotificationService;
  notifeeAvailable = true;
  console.log('✅ pushNotificationService loaded');
} catch (error) {
  console.error('❌ Failed to load notifee:', error.message);
  console.error('   Stack:', error.stack);
  notifeeAvailable = false;
}

export default function TokenDebugComponent() {

  const forceResetTokens = async () => {
    try {
      console.log('🔄 Force resetting Solana tokens...');

      // Reset current tokens
      walletRegistryService.reset('solana');
      console.log('✅ Reset completed');

      // Force reload defaults
      const reloaded = walletRegistryService.forceReloadDefaults('solana');
      console.log('✅ Force reloaded tokens:', reloaded.length);
      console.log('Token breakdown:', {
        total: reloaded.length,
        defaultTokens: reloaded.filter(t => ['XUSDT', 'JYB'].includes(t.symbol)).length,
        stockTokens: reloaded.filter(t => t.type === 'stock').length,
        forexTokens: reloaded.filter(t => t.type === 'forex').length,
      });

      // Re-initialize wallet store
      await walletStore.refresh();
      console.log('✅ Wallet store refreshed');

      Alert.alert(
        'Debug Complete',
        `Reset and reloaded ${reloaded.length} tokens.\n\nCheck console for details.`
      );

    } catch (error) {
      console.error('❌ Force reset failed:', error);
      Alert.alert('Error', `Reset failed: ${error.message}`);
    }
  };

  const checkTokenRegistry = () => {
    try {
      const tokens = walletRegistryService.list('solana');
      const defaults = walletRegistryService.getDefaultsForChain('solana');

      console.log('🔍 Token Registry Check:');
      console.log('   Current tokens:', tokens.length);
      console.log('   Available defaults:', defaults.length);

      const defaultTokens = tokens.filter(t => ['XUSDT', 'JYB'].includes(t.symbol));
      const stockTokens = tokens.filter(t => t.type === 'stock');
      const forexTokens = tokens.filter(t => t.type === 'forex');

      console.log('   Default tokens:', defaultTokens.length, defaultTokens.map(t => t.symbol));
      console.log('   Stock tokens:', stockTokens.length, stockTokens.map(t => t.symbol));
      console.log('   Forex tokens:', forexTokens.length, forexTokens.map(t => t.symbol));

      Alert.alert(
        'Registry Check',
        `Current: ${tokens.length} tokens\nDefaults available: ${defaults.length}\n\nDefault: ${defaultTokens.length}\nStock: ${stockTokens.length}\nForex: ${forexTokens.length}\n\nCheck console for details.`
      );

    } catch (error) {
      console.error('❌ Registry check failed:', error);
      Alert.alert('Error', `Check failed: ${error.message}`);
    }
  };

  const testNotifeeDirectly = async () => {
    console.log('🔔 Testing notifee directly...');

    if (!notifeeModule) {
      Alert.alert(
        'Notifee Not Loaded ❌',
        'Notifee module is not available.\n\nCheck console for error details.'
      );
      return;
    }

    try {
      console.log('Calling notifee.requestPermission()...');
      const settings = await notifeeModule.requestPermission();
      console.log('✅ Permission result:', settings);

      Alert.alert(
        'Notifee Works! ✅',
        `Permission status: ${settings.authorizationStatus}\n\n0=not determined\n1=denied\n2=authorized\n3=provisional`
      );
    } catch (error) {
      console.error('❌ Notifee test failed:', error);
      Alert.alert('Error', `Notifee test failed:\n${error.message}`);
    }
  };

  const requestNotificationPermission = async () => {
    if (!notifeeAvailable || !pushNotificationService) {
      Alert.alert(
        'Service Not Available ❌',
        'Push notification service is not loaded.\n\nTry "Test Notifee Direct" button first to see if notifee works.'
      );
      return;
    }

    try {
      console.log('🔔 Requesting notification permission via service...');

      const granted = await pushNotificationService.requestPermission();

      if (granted) {
        Alert.alert(
          'Permission Granted ✅',
          'Notification permission has been granted!\n\nYou can now test notifications.'
        );
      } else {
        Alert.alert(
          'Permission Denied ❌',
          'Notification permission was denied.\n\nPlease enable it in Settings > Apps > [App Name] > Notifications'
        );
      }

    } catch (error) {
      console.error('❌ Permission request failed:', error);
      Alert.alert('Error', `Request failed: ${error.message}`);
    }
  };

  const testNotifications = async () => {
    if (!notifeeAvailable || !pushNotificationService) {
      Alert.alert(
        'Service Not Available ❌',
        'Push notification service is not loaded.\n\nCheck console for errors.'
      );
      return;
    }

    try {
      console.log('🔔 Testing push notifications...');

      // Check permission first
      const status = await pushNotificationService.getPermissionStatus();
      console.log('Current permission status:', status);

      if (status !== 2) { // 2 = authorized
        Alert.alert(
          'Permission Required',
          'Please grant notification permission first using the "Request Permission" button above.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Initialize notification service
      await pushNotificationService.initialize();

      // Test incoming notification
      await pushNotificationService.notifyIncomingTransaction({
        amount: '1.5',
        symbol: 'ETH',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        txHash: '0xtest123',
        chain: 'ethereum',
      });

      // Test outgoing notification after 2 seconds
      setTimeout(async () => {
        await pushNotificationService.notifyOutgoingTransaction({
          amount: '0.5',
          symbol: 'BTC',
          to: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          txHash: '0xtest456',
          chain: 'bitcoin',
        });
      }, 2000);

      Alert.alert(
        'Test Notifications Sent ✅',
        'Sent 2 test notifications:\n1. Incoming ETH (green)\n2. Outgoing BTC (red, 2s delay)\n\nCheck your notification tray!'
      );

    } catch (error) {
      console.error('❌ Notification test failed:', error);
      Alert.alert('Error', `Test failed: ${error.message}\n\nStack: ${error.stack}`);
    }
  };

  return (
    <View className="bg-red-50 mx-4 mt-2 mb-2 p-3 rounded-lg border border-red-200">
      <VText className="text-base font-bold mb-1 text-red-800">🐛 Debug Panel</VText>
      <VText className="text-xs mb-3 text-red-600">Temporary - remove after fixing</VText>

      {!notifeeAvailable && (
        <View className="bg-yellow-100 p-2 rounded mb-2 border border-yellow-300">
          <VText className="text-xs text-yellow-800">⚠️ Notifee not loaded - check console</VText>
        </View>
      )}

      <VPressable
        className="bg-red-500 p-2 rounded mb-2 active:opacity-70"
        onPress={forceResetTokens}
      >
        <VText className="text-white text-center text-sm font-semibold">🔄 Reset Tokens</VText>
      </VPressable>

      <VPressable
        className="bg-blue-500 p-2 rounded mb-2 active:opacity-70"
        onPress={checkTokenRegistry}
      >
        <VText className="text-white text-center text-sm font-semibold">🔍 Check Registry</VText>
      </VPressable>

      <VPressable
        className="bg-orange-500 p-2 rounded mb-2 active:opacity-70"
        onPress={testNotifeeDirectly}
      >
        <VText className="text-white text-center text-sm font-semibold">🧪 Test Notifee Direct</VText>
      </VPressable>

      <VPressable
        className="bg-purple-500 p-2 rounded mb-2 active:opacity-70"
        onPress={requestNotificationPermission}
      >
        <VText className="text-white text-center text-sm font-semibold">🔔 Request Permission</VText>
      </VPressable>

      <VPressable
        className="bg-green-500 p-2 rounded active:opacity-70"
        onPress={testNotifications}
      >
        <VText className="text-white text-center text-sm font-semibold">📬 Test Notifications</VText>
      </VPressable>
    </View>
  );
}
