// Test script for solxdapp.io wallet detection
// Paste this in browser console when on solxdapp.io

console.log('=== SOLXDAPP.IO Wallet Detection Test ===');

// 1. Check if window.ethereum exists
console.log('1. window.ethereum exists:', !!window.ethereum);
console.log('   window.ethereum:', window.ethereum);

if (window.ethereum) {
  console.log('2. Provider properties:');
  console.log('   - selectedAddress:', window.ethereum.selectedAddress);
  console.log('   - chainId:', window.ethereum.chainId);
  console.log('   - isConnected():', window.ethereum.isConnected?.());
  console.log('   - providerId:', window.ethereum.providerId);
  console.log('   - name:', window.ethereum.name);
  console.log('   - isVCOIN:', window.ethereum.isVCOIN);
  console.log('   - isMetaMask:', window.ethereum.isMetaMask);
  
  // 3. Check provider methods
  console.log('3. Provider methods:');
  console.log('   - request:', typeof window.ethereum.request);
  console.log('   - send:', typeof window.ethereum.send);
  console.log('   - sendAsync:', typeof window.ethereum.sendAsync);
  console.log('   - on:', typeof window.ethereum.on);
  console.log('   - enable:', typeof window.ethereum.enable);
  
  // 4. Test connection
  console.log('4. Testing connection...');
  
  // Test eth_accounts
  window.ethereum.request({ method: 'eth_accounts' })
    .then(accounts => {
      console.log('   eth_accounts result:', accounts);
      if (accounts.length > 0) {
        console.log('   ✅ Wallet is connected with address:', accounts[0]);
      } else {
        console.log('   ⚠️ No accounts returned, trying eth_requestAccounts...');
        
        // Test eth_requestAccounts
        return window.ethereum.request({ method: 'eth_requestAccounts' });
      }
    })
    .then(accounts => {
      if (accounts) {
        console.log('   eth_requestAccounts result:', accounts);
        console.log('   ✅ Connection successful!');
      }
    })
    .catch(error => {
      console.log('   ❌ Connection failed:', error);
    });
  
  // 5. Test chain detection
  console.log('5. Testing chain detection...');
  window.ethereum.request({ method: 'eth_chainId' })
    .then(chainId => {
      console.log('   Current chain ID:', chainId);
      const chainName = {
        '0x1': 'Ethereum Mainnet',
        '0x38': 'BSC Mainnet',
        '0x89': 'Polygon Mainnet'
      }[chainId] || 'Unknown';
      console.log('   Chain name:', chainName);
    })
    .catch(error => {
      console.log('   Chain detection failed:', error);
    });
}

// 6. Check for multiple providers
if (window.ethereum?.providers) {
  console.log('6. Multiple providers detected:');
  window.ethereum.providers.forEach((provider, index) => {
    console.log(`   Provider ${index}:`, {
      name: provider.name,
      providerId: provider.providerId,
      isVCOIN: provider.isVCOIN,
      selectedAddress: provider.selectedAddress
    });
  });
}

// 7. Check EIP-6963 events
console.log('7. Checking EIP-6963 provider discovery...');
window.addEventListener('eip6963:announceProvider', (event) => {
  console.log('   EIP-6963 provider announced:', event.detail);
});

// Request providers
window.dispatchEvent(new Event('eip6963:requestProvider'));

// 8. Manual provider test
console.log('8. Manual provider test functions available:');
console.log('   - testConnect() - Test wallet connection');
console.log('   - testSign() - Test message signing');
console.log('   - testTransaction() - Test transaction');

window.testConnect = async function() {
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    console.log('✅ Connected successfully:', accounts);
    return accounts;
  } catch (error) {
    console.log('❌ Connection failed:', error);
    throw error;
  }
};

window.testSign = async function() {
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
      throw new Error('No accounts connected');
    }
    
    const message = 'Hello from SOLXDAPP.IO test!';
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, accounts[0]]
    });
    
    console.log('✅ Message signed:', signature);
    return signature;
  } catch (error) {
    console.log('❌ Signing failed:', error);
    throw error;
  }
};

window.testTransaction = async function() {
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
      throw new Error('No accounts connected');
    }
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: accounts[0],
        to: accounts[0], // Send to self
        value: '0x0', // 0 ETH
        data: '0x'
      }]
    });
    
    console.log('✅ Transaction sent:', txHash);
    return txHash;
  } catch (error) {
    console.log('❌ Transaction failed:', error);
    throw error;
  }
};

console.log('=== Test completed. Check results above ===');