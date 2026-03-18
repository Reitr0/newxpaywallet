// Transaction Monitor Service
// Monitors wallet transactions and triggers push notifications

import { pushNotificationService } from './pushNotificationService';
import log from '@src/shared/infra/log/logService';

// ── Config ──
const POLL_INTERVAL = 60000;     // Check every 60 seconds
const BATCH_SIZE = 4;            // Check max 4 wallets per cycle
const EMPTY_THRESHOLD = 3;       // After 3 empty results, demote to idle
const IDLE_CHECK_EVERY = 5;      // Idle wallets checked once every 5 cycles (~5 min)

class TransactionMonitorService {
  constructor() {
    this.monitoredWallets = new Map();
    this.pollingInterval = null;
    this.isMonitoring = false;
    this.walletStore = null;
    this._notifiedHashes = new Set();
    this._checkInProgress = false;
    this._cycleCount = 0;
    this._walletKeys = [];       // ordered keys for round-robin
    this._batchIndex = 0;        // current position in round-robin
  }

  /**
   * Start monitoring wallets for transactions
   */
  async startMonitoring(wallets, walletStore = null) {
    if (this.isMonitoring) {
      console.log('⚠️ Transaction monitoring already active');
      return;
    }

    try {
      await pushNotificationService.initialize();
      this.walletStore = walletStore;

      console.log('[TransactionMonitor] 📥 Received wallets to monitor:', wallets.length);

      let skippedCount = 0;
      wallets.forEach(wallet => {
        const hasAddress = wallet.address || wallet.walletAddress;
        const hasChain = wallet.chain;

        if (hasAddress && hasChain) {
          const address = wallet.address || wallet.walletAddress;
          const tokenAddress = wallet.tokenAddress || wallet.contractAddr || null;

          const uniqueKey = tokenAddress
            ? `${wallet.chain}:${address}:${tokenAddress}`
            : `${wallet.chain}:${address}`;

          this.monitoredWallets.set(uniqueKey, {
            address,
            chain: wallet.chain,
            symbol: wallet.symbol,
            lastBalance: wallet.balance || '0',
            lastIncomingHash: null,
            lastOutgoingHash: null,
            isToken: wallet.isToken || false,
            tokenAddress,
            emptyCount: 0,
            // Solana starts idle (expensive RPC). SLX uses local cache so OK to check often.
            isIdle: wallet.chain === 'solana',
          });
          console.log(`[TransactionMonitor] ✅ Added: ${wallet.symbol} (${wallet.chain})`);
        } else {
          skippedCount++;
        }
      });

      this._walletKeys = [...this.monitoredWallets.keys()];
      console.log(`[TransactionMonitor] 📊 Total: ${this._walletKeys.length} monitored, ${skippedCount} skipped`);

      // Initial check (seeds hashes) — skip Solana to save compute
      const initialKeys = this._walletKeys.filter(key => {
        const info = this.monitoredWallets.get(key);
        return info && info.chain !== 'solana';
      });
      console.log(`[TransactionMonitor] 🌱 Initial seed: ${initialKeys.length} wallets (SOL deferred)`);
      await this._checkBatch(initialKeys, true);

      // Start polling
      this.isMonitoring = true;
      this.pollingInterval = setInterval(() => {
        this.checkForNewTransactions();
      }, POLL_INTERVAL);

      console.log(`✅ Transaction monitoring started (${POLL_INTERVAL / 1000}s interval, batch ${BATCH_SIZE})`);
    } catch (error) {
      console.error('❌ Failed to start transaction monitoring:', error);
      log.error('TransactionMonitor: Failed to start', { error: error.message });
    }
  }

  stopMonitoring() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Transaction monitoring stopped');
  }

  /**
   * Pick next batch of wallets to check (round-robin + idle skip)
   */
  _getNextBatch() {
    this._cycleCount++;
    const checkIdle = (this._cycleCount % IDLE_CHECK_EVERY) === 0;
    const batch = [];

    for (let i = 0; i < this._walletKeys.length && batch.length < BATCH_SIZE; i++) {
      const idx = (this._batchIndex + i) % this._walletKeys.length;
      const key = this._walletKeys[idx];
      const info = this.monitoredWallets.get(key);

      // Skip idle wallets unless it's their turn
      if (info?.isIdle && !checkIdle) continue;

      batch.push(key);
    }

    // Advance index for next cycle
    this._batchIndex = (this._batchIndex + BATCH_SIZE) % this._walletKeys.length;

    return batch;
  }

  /**
   * Check for new transactions — batched + throttled
   */
  async checkForNewTransactions() {
    if (!this.walletStore) return;
    if (this._checkInProgress) {
      console.log('⏳ [TransactionMonitor] Previous check still running, skipping...');
      return;
    }
    this._checkInProgress = true;

    try {
      const batch = this._getNextBatch();
      console.log(`🔍 [TransactionMonitor] Cycle #${this._cycleCount}: checking ${batch.length}/${this._walletKeys.length} wallets`);
      await this._checkBatch(batch, false);
    } catch (error) {
      console.error('❌ Error in checkForNewTransactions:', error);
    } finally {
      this._checkInProgress = false;
    }
  }

  /**
   * Check a specific batch of wallet keys
   */
  async _checkBatch(keys, isFirstCheck) {
    let newTxCount = 0;

    for (const uniqueKey of keys) {
      const walletInfo = this.monitoredWallets.get(uniqueKey);
      if (!walletInfo) continue;


      try {
        let historyResult;
        try {
          historyResult = await this.walletStore.getTransactionHistory({
            chain: walletInfo.chain,
            address: walletInfo.address,
            tokenAddress: walletInfo.tokenAddress,
            limit: 2,
          });
        } catch (fetchErr) {
          console.warn(`  ⚠️ [TxMon] ${walletInfo.symbol}: fetch failed — ${fetchErr.message}`);
          continue;
        }

        if (!historyResult || !historyResult.items || historyResult.items.length === 0) {
          // Track empty count → demote to idle after threshold
          const newEmpty = (walletInfo.emptyCount || 0) + 1;
          const shouldIdle = newEmpty >= EMPTY_THRESHOLD && !walletInfo.isIdle;
          this.monitoredWallets.set(uniqueKey, {
            ...walletInfo,
            firstCheckDone: true,
            emptyCount: newEmpty,
            isIdle: walletInfo.isIdle || shouldIdle,
          });
          if (shouldIdle) {
            console.log(`  💤 [TxMon] ${walletInfo.symbol}: demoted to idle (no activity)`);
          }
          continue;
        }

        // Has transactions — reset idle status
        if (walletInfo.isIdle) {
          console.log(`  ⏰ [TxMon] ${walletInfo.symbol}: reactivated (has transactions)`);
        }

        // Filter dust/fee transactions — Solana especially has many micro-txs
        // (rent payments, fee refunds, etc.) that spam notifications
        const DUST_THRESHOLD = {
          solana: 0.001,  // < 0.001 SOL = dust (rent/fees)
          slx: 0.0001,
          ethereum: 0.0001,
          bsc: 0.0001,
          polygon: 0.001,
          default: 0.0001,
        };
        const minValue = DUST_THRESHOLD[walletInfo.chain] || DUST_THRESHOLD.default;
        const hasValue = (tx) => {
          const v = parseFloat(tx.value || '0');
          return !isNaN(v) && v > minValue;
        };
        const latestIncoming = historyResult.items.find(tx => tx.direction === 'in' && hasValue(tx));
        const latestOutgoing = historyResult.items.find(tx => tx.direction === 'out' && hasValue(tx));

        let hasNewTransaction = false;
        const dedupKey = (hash, direction) => `${uniqueKey}:${direction}:${hash}`;

        if (isFirstCheck || !walletInfo.firstCheckDone) {
          // Seed existing hashes
          historyResult.items.forEach(tx => {
            if (tx.hash) this._notifiedHashes.add(dedupKey(tx.hash, tx.direction));
          });
        } else {
          if (latestIncoming) {
            const inKey = dedupKey(latestIncoming.hash, 'in');
            if (!this._notifiedHashes.has(inKey)) {
              newTxCount++;
              hasNewTransaction = true;
              this._notifiedHashes.add(inKey);
              console.log(`🔔 [TxMon] ${walletInfo.symbol} INCOMING: ${latestIncoming.value}`);
              await pushNotificationService.notifyIncomingTransaction({
                amount: latestIncoming.value,
                symbol: latestIncoming.symbol || walletInfo.symbol,
                from: latestIncoming.from || 'Unknown',
                txHash: latestIncoming.hash,
                chain: walletInfo.chain,
              });
            }
          }

          if (latestOutgoing) {
            const outKey = dedupKey(latestOutgoing.hash, 'out');
            if (!this._notifiedHashes.has(outKey)) {
              newTxCount++;
              hasNewTransaction = true;
              this._notifiedHashes.add(outKey);
              console.log(`🔔 [TxMon] ${walletInfo.symbol} OUTGOING: ${latestOutgoing.value}`);
              await pushNotificationService.notifyOutgoingTransaction({
                amount: latestOutgoing.value,
                symbol: latestOutgoing.symbol || walletInfo.symbol,
                to: latestOutgoing.to || 'Unknown',
                txHash: latestOutgoing.hash,
                chain: walletInfo.chain,
              });
            }
          }
        }

        // Update state
        this.monitoredWallets.set(uniqueKey, {
          ...walletInfo,
          firstCheckDone: true,
          emptyCount: 0,
          isIdle: false,
          lastIncomingHash: latestIncoming?.hash || walletInfo.lastIncomingHash,
          lastOutgoingHash: latestOutgoing?.hash || walletInfo.lastOutgoingHash,
        });
      } catch (error) {
        console.error(`❌ [TxMon] ${walletInfo?.symbol}: ${error.message}`);
      }
    }

    if (newTxCount > 0) {
      console.log(`🔔 [TxMon] ${newTxCount} new transaction(s) detected`);
    }
  }

  /**
   * Manually trigger notification for a transaction
   */
  async notifyTransaction(transaction) {
    try {
      const { type, amount, symbol, to, from, txHash, chain } = transaction;
      if (type === 'outgoing' || type === 'send') {
        await pushNotificationService.notifyOutgoingTransaction({ amount, symbol, to, txHash, chain });
      } else if (type === 'incoming' || type === 'receive') {
        await pushNotificationService.notifyIncomingTransaction({ amount, symbol, from, txHash, chain });
      }
    } catch (error) {
      console.error('❌ Failed to notify transaction:', error);
    }
  }
}

// Export singleton instance
export const transactionMonitorService = new TransactionMonitorService();
