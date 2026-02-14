/**
 * Test Script untuk Verifikasi Perbaikan Wallet
 * 
 * Jalankan script ini di React Native debugger untuk memverifikasi:
 * 1. Address consistency saat import wallet
 * 2. DApp provider detection
 */

// Test 1: Address Consistency
async function testAddressConsistency() {
  console.log('🧪 Testing Address Consistency...');
  
  const { walletKeyringService } = require('./src/features/wallet/service/walletKeyringService');
  
  // Test mnemonics dengan berbagai format
  const testCases = [
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "  ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABOUT  ",
    "abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　about", // full-width spaces
    "Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon About"
  ];
  
  try {
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
      console.log(`Testing case ${i + 1}:`, testCases[i]);
      
      // Reset keyring untuk test yang bersih
      walletKeyringService.reset();
      
      const result = await walletKeyringService.deriveAllChains(testCases[i]);
      results.push(result);
      
      console.log(`✅ Case ${i + 1} - Ethereum:`, result.out.ethereum.address);
    }
    
    // Verifikasi semua address sama
    const ethAddresses = results.map(r => r.out.ethereum.address);
    const allSame = ethAddresses.every(addr => addr === ethAddresses[0]);
    
    console.log('\n📊 Results:');
    console.log('All Ethereum addresses:', ethAddresses);
    console.log('✅ All addresses consistent:', allSame);
    
    if (allSame) {
      console.log('🎉 Address Consistency Test: PASSED');
    } else {
      console.log('❌ Address Consistency Test: FAILED');
    }
    
    return allSame;
    
  } catch (error) {
    console.error('❌ Address Consistency Test Error:', error);
    return false;
  }
}

// Test 2: DApp Provider Detection
function testDAppProviderDetection() {
  console.log('\n🧪 Testing DApp Provider Detection...');
  
  try {
    const { dappBrowserStore } = require('./src/features/dapps/state/dappBrowserStore');
    const { buildInjectedProviderScript } = require('./src/features/dapps/service/injectedProvider');
    
    // Test 1: Sync wallet state
    console.log('Testing syncWalletState...');
    dappBrowserStore.syncWalletState();
    console.log('✅ Active address:', dappBrowserStore.activeAddress);
    console.log('✅ Active chain ID:', dappBrowserStore.activeChainId);
    
    // Test 2: Provider script generation
    console.log('\nTesting provider script generation...');
    const script = buildInjectedProviderScript({
      PROVIDER_ID: 'vcoin',
      PROVIDER_NAME: 'VCOIN',
      PROVIDER_LOGO: 'https://example.com/logo.png'
    });
    
    const hasEthereumSetup = script.includes('window.ethereum = provider');
    const hasEIP6963 = script.includes('eip6963:announceProvider');
    const hasLogging = script.includes('console.log');
    
    console.log('✅ Has ethereum setup:', hasEthereumSetup);
    console.log('✅ Has EIP-6963 support:', hasEIP6963);
    console.log('✅ Has debug logging:', hasLogging);
    
    // Test 3: Manual wallet setting
    console.log('\nTesting manual wallet setting...');
    dappBrowserStore.setActiveWallet('0x742d35Cc6634C0532925a3b8D4C9db96590c6C87', 1);
    console.log('✅ Set address:', dappBrowserStore.activeAddress);
    console.log('✅ Set chain ID:', dappBrowserStore.activeChainId);
    console.log('✅ Set chain hex:', dappBrowserStore.activeChainHex);
    
    const allTestsPassed = hasEthereumSetup && hasEIP6963 && hasLogging;
    
    if (allTestsPassed) {
      console.log('🎉 DApp Provider Detection Test: PASSED');
    } else {
      console.log('❌ DApp Provider Detection Test: FAILED');
    }
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('❌ DApp Provider Detection Test Error:', error);
    return false;
  }
}

// Test 3: Integration Test
async function testIntegration() {
  console.log('\n🧪 Testing Integration...');
  
  try {
    const { walletStore } = require('./src/features/wallet/state/walletStore');
    const { dappBrowserStore } = require('./src/features/dapps/state/dappBrowserStore');
    
    // Test wallet initialization
    console.log('Testing wallet initialization...');
    const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    
    // Reset stores
    walletStore.reset();
    
    // Initialize wallet
    await walletStore.init(testMnemonic);
    console.log('✅ Wallet initialized');
    console.log('✅ Wallet status:', walletStore.status);
    console.log('✅ Available chains:', Object.keys(walletStore.instances));
    
    // Sync DApp browser
    dappBrowserStore.syncWalletState();
    console.log('✅ DApp browser synced');
    console.log('✅ DApp active address:', dappBrowserStore.activeAddress);
    
    // Verify address matches
    const ethAddress = walletStore.getWalletAddressByChain('ethereum');
    const dappAddress = dappBrowserStore.activeAddress;
    const addressesMatch = ethAddress?.toLowerCase() === dappAddress?.toLowerCase();
    
    console.log('✅ Wallet ETH address:', ethAddress);
    console.log('✅ DApp active address:', dappAddress);
    console.log('✅ Addresses match:', addressesMatch);
    
    if (addressesMatch && walletStore.status === 'ready') {
      console.log('🎉 Integration Test: PASSED');
      return true;
    } else {
      console.log('❌ Integration Test: FAILED');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Integration Test Error:', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Wallet Fix Verification Tests...\n');
  
  const results = {
    addressConsistency: await testAddressConsistency(),
    dappDetection: testDAppProviderDetection(),
    integration: await testIntegration()
  };
  
  console.log('\n📋 Test Summary:');
  console.log('Address Consistency:', results.addressConsistency ? '✅ PASS' : '❌ FAIL');
  console.log('DApp Detection:', results.dappDetection ? '✅ PASS' : '❌ FAIL');
  console.log('Integration:', results.integration ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Wallet fixes are working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
  }
  
  return results;
}

// Export untuk penggunaan manual
if (typeof window !== 'undefined') {
  window.testAddressConsistency = testAddressConsistency;
  window.testDAppProviderDetection = testDAppProviderDetection;
  window.testIntegration = testIntegration;
  window.runAllTests = runAllTests;
  
  console.log('\n🔧 Test functions available:');
  console.log('- testAddressConsistency()');
  console.log('- testDAppProviderDetection()');
  console.log('- testIntegration()');
  console.log('- runAllTests()');
}

module.exports = {
  testAddressConsistency,
  testDAppProviderDetection,
  testIntegration,
  runAllTests
};