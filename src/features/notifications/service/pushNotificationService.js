// Push Notification Service for Transaction Alerts
// Uses @notifee/react-native for local notifications

import notifee from '@notifee/react-native';
import { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

class PushNotificationService {
  constructor() {
    this.channelId = 'transaction-alerts';
    this.initialized = false;
  }

  /**
   * Initialize notification service
   * Call this once when app starts
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Request permissions - this will show system dialog on Android 13+
      const settings = await notifee.requestPermission();
      console.log('📱 Notification permission settings:', JSON.stringify(settings));
      
      // Android: 0 = NOT_DETERMINED, 1 = DENIED, 2 = AUTHORIZED
      // iOS: 0 = NOT_DETERMINED, 1 = DENIED, 2 = AUTHORIZED, 3 = PROVISIONAL
      const status = settings.authorizationStatus;
      
      if (status === 0) {
        console.warn('⚠️ Notification permission not determined - requesting...');
      } else if (status === 1) {
        console.warn('⚠️ Notification permission denied by user');
        // Don't return - still create channel for when user enables later
      } else if (status === 2) {
        console.log('✅ Notification permission granted');
      } else if (status === 3) {
        console.log('✅ Notification permission granted (provisional)');
      }

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: this.channelId,
          name: 'Transaction Alerts',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });
        console.log('✅ Android notification channel created');
      }

      // Handle notification interactions
      notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS) {
          console.log('Notification pressed:', detail.notification);
          // Navigate to transaction detail if needed
        }
      });

      this.initialized = true;
      console.log('✅ Push notification service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
    }
  }

  /**
   * Manually request notification permission
   * Use this to show permission dialog explicitly
   */
  async requestPermission() {
    try {
      const settings = await notifee.requestPermission();
      console.log('📱 Permission request result:', settings);
      return settings.authorizationStatus === 2; // 2 = authorized
    } catch (error) {
      console.error('❌ Failed to request permission:', error);
      return false;
    }
  }

  /**
   * Show notification for incoming transaction
   * @param {Object} transaction - Transaction details
   */
  async notifyIncomingTransaction(transaction) {
    try {
      const { amount, symbol, from, txHash, chain } = transaction;

      await notifee.displayNotification({
        title: '💰 Received',
        body: `+${amount} ${symbol} from ${this.formatAddress(from)}`,
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          smallIcon: 'ic_notification',
          color: '#10B981', // Green color for incoming
          largeIcon: 'ic_launcher',
        },
        ios: {
          sound: 'default',
          categoryId: 'transaction',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
        data: {
          type: 'incoming',
          txHash,
          chain,
          amount,
          symbol,
        },
      });

      console.log('✅ Incoming transaction notification sent');
    } catch (error) {
      console.error('❌ Failed to send incoming notification:', error);
    }
  }

  /**
   * Show notification for outgoing transaction
   * @param {Object} transaction - Transaction details
   */
  async notifyOutgoingTransaction(transaction) {
    try {
      const { amount, symbol, to, txHash, chain } = transaction;

      await notifee.displayNotification({
        title: '📤 Sent',
        body: `-${amount} ${symbol} to ${this.formatAddress(to)}`,
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          smallIcon: 'ic_notification',
          color: '#EF4444', // Red color for outgoing
          largeIcon: 'ic_launcher',
        },
        ios: {
          sound: 'default',
          categoryId: 'transaction',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
        data: {
          type: 'outgoing',
          txHash,
          chain,
          amount,
          symbol,
        },
      });

      console.log('✅ Outgoing transaction notification sent');
    } catch (error) {
      console.error('❌ Failed to send outgoing notification:', error);
    }
  }

  /**
   * Show notification for transaction confirmation
   * @param {Object} transaction - Transaction details
   */
  async notifyTransactionConfirmed(transaction) {
    try {
      const { amount, symbol, txHash, chain, type } = transaction;
      const emoji = type === 'incoming' ? '✅' : '✓';
      const action = type === 'incoming' ? 'Received' : 'Sent';

      await notifee.displayNotification({
        title: `${emoji} ${action} Confirmed`,
        body: `${amount} ${symbol} transaction confirmed`,
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.DEFAULT,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          smallIcon: 'ic_notification',
          color: '#3B82F6', // Blue color for confirmed
        },
        ios: {
          sound: 'default',
          categoryId: 'transaction',
        },
        data: {
          type: 'confirmed',
          txHash,
          chain,
          amount,
          symbol,
        },
      });

      console.log('✅ Transaction confirmed notification sent');
    } catch (error) {
      console.error('❌ Failed to send confirmation notification:', error);
    }
  }

  /**
   * Format address for display (show first 6 and last 4 characters)
   */
  formatAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Cancel all notifications
   */
  async cancelAll() {
    try {
      await notifee.cancelAllNotifications();
      console.log('✅ All notifications cancelled');
    } catch (error) {
      console.error('❌ Failed to cancel notifications:', error);
    }
  }

  /**
   * Get notification permission status
   */
  async getPermissionStatus() {
    try {
      const settings = await notifee.getNotificationSettings();
      return settings.authorizationStatus;
    } catch (error) {
      console.error('❌ Failed to get permission status:', error);
      return null;
    }
  }

  /**
   * Test notification - for debugging
   */
  async testNotification() {
    try {
      await notifee.displayNotification({
        title: '🧪 Test Notification',
        body: 'If you see this, notifications are working!',
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          smallIcon: 'ic_notification',
          color: '#3B82F6',
        },
      });
      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
