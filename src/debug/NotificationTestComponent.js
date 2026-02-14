import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { pushNotificationService } from '@features/notifications/service/pushNotificationService';

export default function NotificationTestComponent() {
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
    console.log(`[NotifTest] ${message}`);
  };

  const testPermission = async () => {
    addLog('Testing permission request...', 'info');
    try {
      const granted = await pushNotificationService.requestPermission();
      addLog(granted ? '✅ Permission granted' : '❌ Permission denied', granted ? 'success' : 'error');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    }
  };

  const testIncoming = async () => {
    addLog('Sending incoming transaction notification...', 'info');
    try {
      await pushNotificationService.notifyIncomingTransaction({
        amount: '0.5',
        symbol: 'SOL',
        from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        txHash: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprXqPZhH5',
        chain: 'solana'
      });
      addLog('✅ Incoming notification sent', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    }
  };

  const testOutgoing = async () => {
    addLog('Sending outgoing transaction notification...', 'info');
    try {
      await pushNotificationService.notifyOutgoingTransaction({
        amount: '1.2',
        symbol: 'ETH',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        txHash: '0x123abc...',
        chain: 'ethereum'
      });
      addLog('✅ Outgoing notification sent', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    }
  };

  const testConfirmed = async () => {
    addLog('Sending confirmation notification...', 'info');
    try {
      await pushNotificationService.notifyTransactionConfirmed({
        amount: '0.5',
        symbol: 'SOL',
        txHash: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprXqPZhH5',
        chain: 'solana',
        type: 'incoming'
      });
      addLog('✅ Confirmation notification sent', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    }
  };

  const checkStatus = async () => {
    addLog('Checking permission status...', 'info');
    try {
      const status = await pushNotificationService.getPermissionStatus();
      const statusText = ['Not Determined', 'Denied', 'Authorized', 'Provisional'][status] || 'Unknown';
      addLog(`📱 Status: ${statusText} (${status})`, 'info');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Notification Test</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testPermission}>
          <Text style={styles.buttonText}>Request Permission</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={checkStatus}>
          <Text style={styles.buttonText}>Check Status</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.successButton]} onPress={testIncoming}>
          <Text style={styles.buttonText}>Test Incoming 💰</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.errorButton]} onPress={testOutgoing}>
          <Text style={styles.buttonText}>Test Outgoing 📤</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={testConfirmed}>
          <Text style={styles.buttonText}>Test Confirmed ✅</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={[styles.logText, styles[`log_${log.type}`]]}>
            [{log.timestamp}] {log.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  errorButton: {
    backgroundColor: '#EF4444',
  },
  infoButton: {
    backgroundColor: '#8B5CF6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 10,
  },
  logTitle: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  logText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  log_info: {
    color: '#60A5FA',
  },
  log_success: {
    color: '#34D399',
  },
  log_error: {
    color: '#F87171',
  },
});
