// Debug script to test wallet consistency
// Run this in React Native debugger console

import { walletKeyringService } from './src/features/wallet/service/walletKeyringService';

// Test mnemonic normalization
const testMnemonic1 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const testMnemonic2 = "  ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABANDON   ABOUT  ";
const testMnemonic3 = "abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　abandon　about"; // full-width spaces

console.log('=== Wallet Address Consistency Test ===');

async function testAddressConsistency() {
  try {
    // Test 1: Same mnemonic should produce same addresses
    console.log('\n1. Testing mnemonic normalization...');
    
    const normalized1 = walletKeyringService.normalizeMnemonic(testMnemonic1);
    const normalized2 = walletKeyringService.normalizeMnemonic(testMnemonic2);
    const normalized3 = walletKeyringService.normalizeMnemonic(testMnemonic3);
    
    console.log('Original:', testMnemonic1);
    console.log('Normalized 1:', normalized1);
    console.log('Normalized 2:', normalized2);
    console.log('Normalized 3:', normalized3);
    console.log('All normalized equal:', normalized1 === normalized2 && normalized2 === normalized3);
    
    // Test 2: Derive addresses multiple times
    console.log('\n2. Testing address derivation consistency...');
    
    const result1 = await walletKeyringService.deriveAllChains(testMnemonic1);
    const result2 = await walletKeyringService.deriveAllChains(testMnemonic2);
    
    console.log('Ethereum address 1:', result1.out.ethereum.address);
    console.log('Ethereum address 2:', result2.out.ethereum.address);
    console.log('Addresses match:', result1.out.ethereum.address === result2.out.ethereum.address);
    
    // Test 3: Check all chains
    console.log('\n3. All derived addresses:');
    Object.keys(result1.out).forEach(chain => {
      console.log(`${chain}: ${result1.out[chain].address}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test DApp provider detection
function testDAppProvider() {
  console.log('\n=== DApp Provider Detection Test ===');
  
  // Simulate injected provider
  const mockProvider = {
    selectedAddress: '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87',
    chainId: '0x1',
    isConnected: () => true,
    request: (args) => {
      console.log('Provider request:', args);
      return Promise.resolve(['0x742d35Cc6634C0532925a3b8D4C9db96590c6C87']);
    }
  };
  
  console.log('Mock provider:', mockProvider);
  console.log('Is connected:', mockProvider.isConnected());
  console.log('Selected address:', mockProvider.selectedAddress);
}

// Export for manual testing
window.testWalletConsistency = testAddressConsistency;
window.testDAppProvider = testDAppProvider;

console.log('\n=== Debug Functions Available ===');
console.log('Run: testWalletConsistency()');
console.log('Run: testDAppProvider()');