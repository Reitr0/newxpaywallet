// Force connect script - Inject this directly into WebView for testing
// This simulates a successful connection

(function forceConnect() {
  console.log('=== Force Connect Script ===');
  
  // 1. Check if provider exists
  if (!window.ethereum) {
    console.error('❌ No ethereum provider found!');
    return;
  }
  
  console.log('✅ Provider found:', window.ethereum.name);
  
  // 2. Force set selectedAddress
  const testAddress = '0x99a6ee7f83aace35d53fd891072fc477dfb9a9d9';
  const testChainId = '0x38'; // BSC
  
  if (window.ethereum._syncState) {
    window.ethereum._syncState({
      selectedAddress: testAddress,
      chainId: testChainId
    });
    console.log('✅ State synced via _syncState');
  } else {
    // Manual sync
    window.ethereum.selectedAddress = testAddress;
    window.ethereum.chainId = testChainId;
    console.log('✅ State synced manually');
  }
  
  // 3. Emit events
  if (window.ethereum._emitEvent) {
    window.ethereum._emitEvent('connect', { chainId: testChainId });
    window.ethereum._emitEvent('accountsChanged', [testAddress]);
    window.ethereum._emitEvent('chainChanged', testChainId);
    console.log('✅ Events emitted');
  }
  
  // 4. Verify
  console.log('Provider state after force connect:');
  console.log('- selectedAddress:', window.ethereum.selectedAddress);
  console.log('- chainId:', window.ethereum.chainId);
  console.log('- isConnected():', window.ethereum.isConnected());
  
  // 5. Test eth_accounts
  window.ethereum.request({ method: 'eth_accounts' })
    .then(accounts => {
      console.log('✅ eth_accounts returned:', accounts);
      if (accounts.length === 0) {
        console.warn('⚠️ No accounts returned, but provider is connected');
      }
    })
    .catch(error => {
      console.error('❌ eth_accounts failed:', error);
    });
  
  console.log('=== Force Connect Complete ===');
  console.log('Try refreshing the page or clicking connect button');
})();

// Export for manual use
window.forceConnect = function() {
  const testAddress = '0x99a6ee7f83aace35d53fd891072fc477dfb9a9d9';
  const testChainId = '0x38';
  
  if (window.ethereum) {
    window.ethereum.selectedAddress = testAddress;
    window.ethereum.chainId = testChainId;
    
    if (window.ethereum._emitEvent) {
      window.ethereum._emitEvent('connect', { chainId: testChainId });
      window.ethereum._emitEvent('accountsChanged', [testAddress]);
    }
    
    console.log('✅ Force connected:', testAddress);
    return { address: testAddress, chainId: testChainId };
  }
  
  console.error('❌ No provider found');
  return null;
};

console.log('Force connect function available: window.forceConnect()');