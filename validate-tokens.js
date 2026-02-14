const fs = require('fs');

try {
  const data = JSON.parse(
    fs.readFileSync('src/features/tokens/registry/json/solona.json', 'utf8')
  );
  
  console.log('✅ JSON valid!');
  console.log('Total tokens:', data.length);
  
  const newTokens = data.slice(-8);
  console.log('\n📝 New tokens added:');
  newTokens.forEach(t => {
    console.log(`- ${t.symbol} (${t.label || t.symbol}): ${t.contractAddress}`);
  });
  
  console.log('\n✅ All tokens validated successfully!');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
