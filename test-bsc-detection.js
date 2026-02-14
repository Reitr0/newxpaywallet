// Test BSC Detection
// Run this in React Native debugger console

import { dappBrowserStore } from './src/features/dapps/state/dappBrowserStore';
import { walletStore } from './src/features/wallet/state/walletStore';

console.log('=== BSC Detection Test ===');

// Test URLs
const testUrls = [
  'https://solxdapp.io',
  'https://pancakeswap.finance',
  'https://app.uniswap.org',
  'https://bscscan.com'
];

console.log('\n1. Testing URL detection:');
testUrls.forEach(url => {
  dappBrowserStore.setUrl(url);
  dappBrowserStore.syncWalletState();
  
  const isBsc = url.includes('solxdapp') || 
                url.includes('pancake') || 
                url.includes('bsc');
  
  console.log(`\nURL: ${url}`);
  console.log(`  Expected BSC: ${isBsc}`);
  console.log(`  Chain ID: ${dappBrowserStore.activeChainId}`);
  console.log(`  Chain Hex: ${dappBrowserStore.activeChainHex}`);
  console.log(`  Address: ${dappBrowserStore.activeAddress}`);
  console.log(`  Match: ${isBsc ? (dappBrowserStore.activeChainId === 56 ? '✅' : '❌') : (dappBrowserStore.activeChainId === 1 ? '✅' : '❌')}`);
});

console.log('\n2. Testing wallet addresses:');
const ethAddress = walletStore.getWalletAddressByChain('ethereum');
const bscAddress = walletStore.getWalletAddressByChain('bsc');

console.log(`Ethereum address: ${ethAddress}`);
console.log(`BSC address: ${bscAddress}`);
console.log(`Addresses match: ${ethAddress === bscAddress ? '✅ (Same for EVM)' : '❌'}`);

console.log('\n3. Testing solxdapp.io specifically:');
dappBrowserStore.setUrl('https://solxdapp.io');
dappBrowserStore.syncWalletState();

console.log(`Host: ${dappBrowserStore.host}`);
console.log(`URL: ${dappBrowserStore.url}`);
console.log(`Chain ID: ${dappBrowserStore.activeChainId}`);
console.log(`Chain Hex: ${dappBrowserStore.activeChainHex}`);
console.log(`Address: ${dappBrowserStore.activeAddress}`);
console.log(`Should be BSC (56): ${dappBrowserStore.activeChainId === 56 ? '✅' : '❌'}`);
console.log(`Should be 0x38: ${dappBrowserStore.activeChainHex === '0x38' ? '✅' : '❌'}`);

console.log('\n=== Test Complete ===');

// Export test function
window.testBscDetection = function() {
  dappBrowserStore.setUrl('https://solxdapp.io');
  dappBrowserStore.syncWalletState();
  
  return {
    url: dappBrowserStore.url,
    host: dappBrowserStore.host,
    chainId: dappBrowserStore.activeChainId,
    chainHex: dappBrowserStore.activeChainHex,
    address: dappBrowserStore.activeAddress,
    isBSC: dappBrowserStore.activeChainId === 56,
    isCorrectHex: dappBrowserStore.activeChainHex === '0x38'
  };
};

console.log('\nManual test available: testBscDetection()');