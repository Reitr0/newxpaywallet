// Quick test script for push notifications
// Run this after app is running to test notifications

console.log('🔔 Push Notification Test Script');
console.log('');
console.log('To test notifications:');
console.log('1. Make sure app is running');
console.log('2. Open debug panel in app');
console.log('3. Press "🔔 Test Notifications" button');
console.log('');
console.log('Or use this code in your app:');
console.log('');
console.log('```javascript');
console.log('import { pushNotificationService } from "@features/notifications/service/pushNotificationService";');
console.log('');
console.log('// Test incoming transaction');
console.log('await pushNotificationService.notifyIncomingTransaction({');
console.log('  amount: "1.5",');
console.log('  symbol: "ETH",');
console.log('  from: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",');
console.log('  txHash: "0xtest123",');
console.log('  chain: "ethereum",');
console.log('});');
console.log('');
console.log('// Test outgoing transaction');
console.log('await pushNotificationService.notifyOutgoingTransaction({');
console.log('  amount: "0.5",');
console.log('  symbol: "BTC",');
console.log('  to: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",');
console.log('  txHash: "0xtest456",');
console.log('  chain: "bitcoin",');
console.log('});');
console.log('```');
console.log('');
console.log('Expected behavior:');
console.log('- Green notification for incoming transaction');
console.log('- Red notification for outgoing transaction');
console.log('- Notification sound and vibration');
console.log('- Notification appears in notification tray');
