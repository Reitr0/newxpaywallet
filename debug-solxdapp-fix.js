// Debug script untuk memperbaiki koneksi ke solxdapp.io
// Jalankan di React Native debugger console

console.log('=== SOLXDAPP.IO Connection Fix Debug ===');

// 1. Test wallet store state
import { walletStore } from './src/features/wallet/state/walletStore';
import { dappBrowserStore } from './src/features/dapps/state/dappBrowserStore';

async function debugWalletState() {
  console.log('\n1. Wallet Store State:');
  console.log('   Status:', walletStore.status);
  console.log('   Data:', walletStore.data);
  console.log('   Instances:', Object.keys(walletStore.instances || {}));
  
  // Test address retrieval
  const ethAddress = walletStore.getWalletAddressByChain('ethereum');
  const bscAddress = walletStore.getWalletAddressByChain('bsc');
  
  console.log('   Ethereum address:', ethAddress);
  console.log('   BSC address:', bscAddress);
  
  return { ethAddress, bscAddress };
}

async function debugDappBrowserState() {
  console.log('\n2. DApp Browser State:');
  console.log('   Active address:', dappBrowserStore.activeAddress);
  console.log('   Active chain ID:', dappBrowserStore.activeChainId);
  console.log('   Active chain hex:', dappBrowserStore.activeChainHex);
  
  // Test sync
  console.log('\n   Testing sync...');
  dappBrowserStore.syncWalletState();
  
  console.log('   After sync:');
  console.log('   Active address:', dappBrowserStore.activeAddress);
  console.log('   Active chain ID:', dappBrowserStore.activeChainId);
  console.log('   Active chain hex:', dappBrowserStore.activeChainHex);
}

async function testProviderInjection() {
  console.log('\n3. Provider Injection Test:');
  
  // Simulate provider injection
  const mockWebView = {
    injectJavaScript: (script) => {
      console.log('   Injecting script:', script.substring(0, 100) + '...');
    }
  };
  
  // Test sync state script
  const { jsSyncState } = await import('./src/features/dapps/service/injectionHelpers');
  
  const syncScript = jsSyncState({
    selectedAddress: dappBrowserStore.activeAddress,
    chainId: dappBrowserStore.activeChainHex
  });
  
  console.log('   Sync script generated:', !!syncScript);
  mockWebView.injectJavaScript(syncScript);
}

async function testBSCDetection() {
  console.log('\n4. BSC Detection Test:');
  
  // Test URL patterns
  const testUrls = [
    'https://solxdapp.io',
    'https://pancakeswap.finance',
    'https://bscscan.com',
    'https://app.uniswap.org'
  ];
  
  testUrls.forEach(url => {
    dappBrowserStore.setUrl(url);
    dappBrowserStore.syncWalletState();
    
    console.log(`   URL: ${url}`);
    console.log(`   Chain ID: ${dappBrowserStore.activeChainId}`);
    console.log(`   Address: ${dappBrowserStore.activeAddress}`);
  });
}

async function runAllTests() {
  try {
    await debugWalletState();
    await debugDappBrowserState();
    await testProviderInjection();
    await testBSCDetection();
    
    console.log('\n=== All tests completed ===');
    console.log('If wallet is not detected in solxdapp.io:');
    console.log('1. Check if wallet addresses are properly generated');
    console.log('2. Verify provider injection is working');
    console.log('3. Check browser console for provider logs');
    console.log('4. Try manual connection with testConnect() function');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Manual fix functions
window.fixSolxdappConnection = async function() {
  console.log('🔧 Attempting to fix solxdapp.io connection...');
  
  // 1. Force sync wallet state
  dappBrowserStore.syncWalletState();
  
  // 2. Set BSC as active chain
  const bscAddress = walletStore.getWalletAddressByChain('bsc');
  if (bscAddress) {
    dappBrowserStore.setActiveWallet(bscAddress, 56); // BSC mainnet
    console.log('✅ Set BSC wallet as active:', bscAddress);
  }
  
  // 3. Log current state
  console.log('Current state:');
  console.log('- Address:', dappBrowserStore.activeAddress);
  console.log('- Chain:', dappBrowserStore.activeChainId);
  console.log('- Chain Hex:', dappBrowserStore.activeChainHex);
  
  return {
    address: dappBrowserStore.activeAddress,
    chainId: dappBrowserStore.activeChainId,
    chainHex: dappBrowserStore.activeChainHex
  };
};

window.testWalletConnection = async function() {
  console.log('🧪 Testing wallet connection...');
  
  const addresses = {};
  const chains = ['ethereum', 'bsc', 'polygon'];
  
  for (const chain of chains) {
    const address = walletStore.getWalletAddressByChain(chain);
    addresses[chain] = address;
    console.log(`${chain}: ${address || 'NOT FOUND'}`);
  }
  
  return addresses;
};

// Export functions
window.debugWalletState = debugWalletState;
window.debugDappBrowserState = debugDappBrowserState;
window.testProviderInjection = testProviderInjection;
window.testBSCDetection = testBSCDetection;
window.runAllTests = runAllTests;

console.log('\n=== Debug Functions Available ===');
console.log('- runAllTests() - Run all debug tests');
console.log('- fixSolxdappConnection() - Attempt to fix connection');
console.log('- testWalletConnection() - Test wallet addresses');
console.log('- debugWalletState() - Check wallet state');
console.log('- debugDappBrowserState() - Check DApp browser state');

// Auto-run basic tests
runAllTests();