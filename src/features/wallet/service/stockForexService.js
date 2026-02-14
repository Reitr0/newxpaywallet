// src/features/wallet/service/stockForexService.js
import { walletRegistryService } from '@features/wallet/service/walletRegistryService';
import log from '@src/shared/infra/log/logService';
import stockSolana from '@src/features/tokens/registry/json/stock-solana.json';
import forexSolana from '@src/features/tokens/registry/json/forex-solana.json';

/**
 * Auto-enable stock and forex tokens for Solana chain
 * This should be called once after wallet initialization
 */
export const stockForexService = {
  /**
   * Enable all stock and forex tokens for Solana
   * @returns {Promise<void>}
   */
  async enableStockAndForexTokens() {
    console.log('📊 ====== STOCKFOREX SERVICE CALLED ======');
    try {
      const chain = 'solana';
      
      // Use imported JSON directly instead of getDefaultsForChain
      const stockTokens = stockSolana || [];
      const forexTokens = forexSolana || [];
      
      console.log('📊 Stock/Forex from JSON:', {
        stockCount: stockTokens.length,
        forexCount: forexTokens.length,
        stockSymbols: stockTokens.map(t => t.symbol),
        forexSymbols: forexTokens.map(t => t.symbol),
      });
      
      // Register each token using upsertMany (not register which doesn't exist)
      const allSpecialTokens = [...stockTokens, ...forexTokens];
      console.log('📊 Adding tokens via upsertMany...');
      walletRegistryService.upsertMany(chain, allSpecialTokens);
      
      // Verify tokens are registered
      const finalCheck = walletRegistryService.list(chain) || [];
      console.log('📊 Final verification:', {
        total: finalCheck.length,
        stockInRegistry: finalCheck.filter(t => t.type === 'stock').length,
        forexInRegistry: finalCheck.filter(t => t.type === 'forex').length,
        stockSymbols: finalCheck.filter(t => t.type === 'stock').map(t => t.symbol),
        forexSymbols: finalCheck.filter(t => t.type === 'forex').map(t => t.symbol),
      });
      
      log.info('Stock and forex tokens registered', {
        stockCount: stockTokens.length,
        forexCount: forexTokens.length,
      });
      
      console.log('📊 ====== STOCKFOREX SERVICE COMPLETED ======');
    } catch (e) {
      console.error('📊 stockForexService error:', e);
      log.warn('Failed to enable stock/forex tokens', { message: e?.message });
    }
  },
  
  /**
   * Check if stock/forex tokens are enabled
   * @returns {boolean}
   */
  isStockForexEnabled() {
    try {
      const chain = 'solana';
      const tokens = walletRegistryService.list(chain) || [];
      const hasStock = tokens.some(t => t.type === 'stock');
      const hasForex = tokens.some(t => t.type === 'forex');
      return hasStock && hasForex;
    } catch {
      return false;
    }
  },
};

export default stockForexService;
