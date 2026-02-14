// Transaction Monitor Service
// Monitors wallet transactions and triggers push notifications

import { pushNotificationService } from './pushNotificationService';
import log from '@src/shared/infra/log/logService';

class TransactionMonitorService {
  constructor() {
    this.monitoredWallets = new Map(); // address -> { chain, lastTxHash, lastBalance }
    this.pollingInterval = null;
    this.pollingIntervalMs = 10000; // Check every 10 seconds
    this.isMonitoring = false;
    this.walletStore = null; // Will be set when monitoring starts
  }

  /**
   * Start monitoring wallets for transactions
   * @param {Array} wallets - Array of wallet objects with address and chain
   * @param {Object} walletStore - Reference to walletStore for fetching history
   */
  async startMonitoring(wallets, walletStore = null) {
    if (this.isMonitoring) {
      console.log('⚠️ Transaction monitoring already active');
      return;
    }

    try {
      // Initialize push notification service
      await pushNotificationService.initialize();

      // Store wallet store reference
      this.walletStore = walletStore;

      // Store initial wallet states
      console.log('[TransactionMonitor] 📥 Received wallets to monitor:', wallets.length);
      console.log('[TransactionMonitor] 📋 Sample wallet structure:', wallets[0]);
      
      let skippedCount = 0;
      wallets.forEach(wallet => {
        // Check if wallet has required fields
        const hasAddress = wallet.address || wallet.walletAddress;
        const hasChain = wallet.chain;
        
        if (hasAddress && hasChain) {
          const address = wallet.address || wallet.walletAddress;
          const tokenAddress = wallet.tokenAddress || wallet.contractAddr || null;
          
          // Create unique key: for tokens, combine address + tokenAddress
          // For native, just use address
          const uniqueKey = tokenAddress 
            ? `${address}:${tokenAddress}` 
            : address;
          
          this.monitoredWallets.set(uniqueKey, {
            address: address, // Store actual wallet address
            chain: wallet.chain,
            symbol: wallet.symbol,
            lastBalance: wallet.balance || '0',
            lastIncomingHash: null, // Track incoming separately
            lastOutgoingHash: null, // Track outgoing separately
            isToken: wallet.isToken || false,
            tokenAddress: tokenAddress,
          });
          console.log(`[TransactionMonitor] ✅ Added: ${wallet.symbol} (${wallet.chain})`);
        } else {
          skippedCount++;
          console.log(`[TransactionMonitor] ⏭️ Skipped: ${wallet.symbol} - missing address or chain`, {
            hasAddress,
            hasChain,
            wallet: wallet
          });
        }
      });
      
      console.log(`[TransactionMonitor] 📊 Summary: ${this.monitoredWallets.size} monitored, ${skippedCount} skipped`);

      // Do initial check to set lastTxHash
      await this.checkForNewTransactions();

      // Start polling
      this.isMonitoring = true;
      this.pollingInterval = setInterval(() => {
        this.checkForNewTransactions();
      }, this.pollingIntervalMs);

      console.log(`✅ Transaction monitoring started for ${this.monitoredWallets.size} wallets`);
    } catch (error) {
      console.error('❌ Failed to start transaction monitoring:', error);
      log.error('TransactionMonitor: Failed to start', { error: error.message });
    }
  }

  /**
   * Stop monitoring transactions
   */
  stopMonitoring() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Transaction monitoring stopped');
  }

  /**
   * Check for new transactions by fetching latest transaction history
   */
  async checkForNewTransactions() {
    if (!this.walletStore) {
      console.warn('⚠️ WalletStore not available, skipping transaction check');
      return;
    }

    console.log('🔍 [TransactionMonitor] Checking for new transactions...');
    console.log('📊 [TransactionMonitor] Monitoring', this.monitoredWallets.size, 'wallets');

    try {
      let checkedCount = 0;
      let newTxCount = 0;
      let skippedCount = 0;
      
      for (const [uniqueKey, walletInfo] of this.monitoredWallets.entries()) {
        try {
          checkedCount++;
          console.log(`🔎 [TransactionMonitor] Checking wallet ${checkedCount}/${this.monitoredWallets.size}:`, {
            address: walletInfo.address.slice(0, 8) + '...',
            chain: walletInfo.chain,
            symbol: walletInfo.symbol,
            isToken: walletInfo.isToken,
            lastInHash: walletInfo.lastIncomingHash ? walletInfo.lastIncomingHash.slice(0, 8) + '...' : 'none',
            lastOutHash: walletInfo.lastOutgoingHash ? walletInfo.lastOutgoingHash.slice(0, 8) + '...' : 'none',
          });
          
          // Note: We DON'T skip tokens with 0 balance anymore
          // We need to monitor them to detect the FIRST incoming transaction
          
          // Fetch latest transactions (get more to catch both incoming and outgoing)
          // For tokens, we need to pass both wallet address and token address
          const historyResult = await this.walletStore.getTransactionHistory({
            chain: walletInfo.chain,
            address: walletInfo.address, // Pass the wallet address
            tokenAddress: walletInfo.tokenAddress, // Pass token address if it's a token
            limit: 5, // Get last 5 transactions to catch both in/out
          });

          if (!historyResult || !historyResult.items || historyResult.items.length === 0) {
            console.log(`  ℹ️ [TransactionMonitor] No transactions found`);
            continue;
          }

          // Find latest incoming and outgoing transactions
          const latestIncoming = historyResult.items.find(tx => tx.direction === 'in');
          const latestOutgoing = historyResult.items.find(tx => tx.direction === 'out');
          
          console.log(`  📝 [TransactionMonitor] Latest transactions:`, {
            incoming: latestIncoming ? latestIncoming.hash.slice(0, 8) + '...' : 'none',
            outgoing: latestOutgoing ? latestOutgoing.hash.slice(0, 8) + '...' : 'none',
          });

          let hasNewTransaction = false;

          // Check for new incoming transaction
          if (latestIncoming) {
            const inHash = latestIncoming.hash;
            if (walletInfo.lastIncomingHash && inHash !== walletInfo.lastIncomingHash) {
              newTxCount++;
              hasNewTransaction = true;
              console.log('🔔 [TransactionMonitor] NEW INCOMING TRANSACTION!', {
                hash: inHash.slice(0, 8) + '...',
                value: latestIncoming.value,
                symbol: latestIncoming.symbol,
              });

              console.log('  💰 [TransactionMonitor] Triggering INCOMING notification...');
              await pushNotificationService.notifyIncomingTransaction({
                amount: latestIncoming.value,
                symbol: latestIncoming.symbol || walletInfo.symbol,
                from: latestIncoming.from || 'Unknown',
                txHash: inHash,
                chain: walletInfo.chain,
              });
              console.log('  ✅ [TransactionMonitor] Incoming notification sent');
            } else if (!walletInfo.lastIncomingHash) {
              console.log(`  ℹ️ [TransactionMonitor] First check, setting initial incoming hash`);
            }
          }

          // Check for new outgoing transaction
          if (latestOutgoing) {
            const outHash = latestOutgoing.hash;
            if (walletInfo.lastOutgoingHash && outHash !== walletInfo.lastOutgoingHash) {
              newTxCount++;
              hasNewTransaction = true;
              console.log('🔔 [TransactionMonitor] NEW OUTGOING TRANSACTION!', {
                hash: outHash.slice(0, 8) + '...',
                value: latestOutgoing.value,
                symbol: latestOutgoing.symbol,
              });

              console.log('  📤 [TransactionMonitor] Triggering OUTGOING notification...');
              await pushNotificationService.notifyOutgoingTransaction({
                amount: latestOutgoing.value,
                symbol: latestOutgoing.symbol || walletInfo.symbol,
                to: latestOutgoing.to || 'Unknown',
                txHash: outHash,
                chain: walletInfo.chain,
              });
              console.log('  ✅ [TransactionMonitor] Outgoing notification sent');
            } else if (!walletInfo.lastOutgoingHash) {
              console.log(`  ℹ️ [TransactionMonitor] First check, setting initial outgoing hash`);
            }
          }

          if (!hasNewTransaction && (walletInfo.lastIncomingHash || walletInfo.lastOutgoingHash)) {
            console.log(`  ✅ [TransactionMonitor] No new transactions`);
          }

          // Update last transaction hashes (track both directions separately)
          this.monitoredWallets.set(uniqueKey, {
            ...walletInfo,
            lastIncomingHash: latestIncoming?.hash || walletInfo.lastIncomingHash,
            lastOutgoingHash: latestOutgoing?.hash || walletInfo.lastOutgoingHash,
          });
        } catch (error) {
          console.error(`❌ Error checking transactions for ${walletInfo.address}:`, error.message);
        }
      }
      
      console.log(`✅ [TransactionMonitor] Check complete: ${checkedCount} wallets, ${skippedCount} skipped, ${newTxCount} new tx`);
    } catch (error) {
      console.error('❌ Error in checkForNewTransactions:', error);
      log.error('TransactionMonitor: Check failed', { error: error.message });
    }
  }

  /**
   * Manually trigger notification for a transaction
   * Use this when sending a transaction
   */
  async notifyTransaction(transaction) {
    try {
      const { type, amount, symbol, to, from, txHash, chain } = transaction;

      if (type === 'outgoing' || type === 'send') {
        await pushNotificationService.notifyOutgoingTransaction({
          amount,
          symbol,
          to,
          txHash,
          chain,
        });
      } else if (type === 'incoming' || type === 'receive') {
        await pushNotificationService.notifyIncomingTransaction({
          amount,
          symbol,
          from,
          txHash,
          chain,
        });
      }
    } catch (error) {
      console.error('❌ Failed to notify transaction:', error);
    }
  }

  /**
   * Update polling interval
   * @param {number} intervalMs - Interval in milliseconds
   */
  setPollingInterval(intervalMs) {
    this.pollingIntervalMs = intervalMs;
    if (this.isMonitoring) {
      this.stopMonitoring();
      // Restart with new interval (you'll need to pass wallets again)
      console.log(`⚙️ Polling interval updated to ${intervalMs}ms`);
    }
  }
}

// Export singleton instance
export const transactionMonitorService = new TransactionMonitorService();
