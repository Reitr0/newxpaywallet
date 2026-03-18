// src/features/browser/services/rpcHandlers/signHandlers.js
import { getBytes, hexlify, Signature } from 'ethers';
import { CHAIN_ID_TO_FAMILY } from '@src/shared/config/chain/constants';

export const signHandlers = (ctx) => ({
  /**
   * eth_sign — raw hash signing (no EIP-191 prefix)
   * params: [address, messageHash]
   */
  async eth_sign(params) {
    const { walletStore, chainId, activeAddr, confirmDialog } = ctx;
    const [from, msgHash] = params;

    console.log('🖊️ [eth_sign] chainId:', chainId, 'from:', from, 'activeAddr:', activeAddr);

    if (!activeAddr || activeAddr.toLowerCase() !== String(from).toLowerCase())
      throw new Error('Invalid from address');

    const ok = await confirmDialog('Sign message', `Sign raw data as ${from}?\n\nWarning: eth_sign signs raw data without prefix.`);
    if (!ok) throw new Error('User rejected');

    // Try to sign with any available EVM wallet instance
    const chainIds = [chainId, 781234, 56, 1, 137];
    const tried = new Set();
    for (const cid of chainIds) {
      if (tried.has(cid)) continue;
      tried.add(cid);
      try {
        const chain = CHAIN_ID_TO_FAMILY[cid];
        if (!chain) continue;
        const inst = walletStore.instances?.[chain];
        if (!inst?._wallet?.signingKey) continue;

        // eth_sign: sign raw 32-byte hash directly (no EIP-191 prefix)
        const digest = getBytes(msgHash);
        const sig = inst._wallet.signingKey.sign(digest);
        const signature = Signature.from(sig).serialized;
        console.log('✅ [eth_sign] Signed via chain:', chain, '(chainId:', cid, ')');
        return signature;
      } catch (e) {
        console.warn('⚠️ [eth_sign] Failed on chainId', cid, ':', e?.message);
      }
    }
    throw new Error('No wallet instance available for signing');
  },
  async personal_sign(params) {
    const { walletStore, chainId, activeAddr, confirmDialog } = ctx;
    let msg, from;
    const [a, b] = params;
    if (String(a).startsWith('0x') && a.length > 42) { msg = a; from = b; } else { from = a; msg = b; }

    console.log('🖊️ [personal_sign] chainId:', chainId, 'from:', from, 'activeAddr:', activeAddr);

    if (!activeAddr || activeAddr.toLowerCase() !== String(from).toLowerCase())
      throw new Error('Invalid from address');

    const ok = await confirmDialog('Sign message', `Sign as ${from}?`);
    if (!ok) throw new Error('User rejected');

    // ensure correct encoding
    const isHex = msg.startsWith('0x');
    const rawMsg = isHex ? msg : '0x' + Buffer.from(msg, 'utf8').toString('hex');

    // Try signing with current chain, fallback to any EVM chain
    // personal_sign (EIP-191) is chain-independent - same key produces same signature
    try {
      const { signature } = await walletStore.signPersonalMessage(from, rawMsg, chainId);
      console.log('✅ [personal_sign] Signed on chain:', chainId);
      return signature;
    } catch (e) {
      console.warn('⚠️ [personal_sign] Failed on chain', chainId, ':', e?.message, '— trying fallback chains');
      // Try other EVM chains since personal_sign is chain-independent
      const fallbackChains = [781234, 56, 1, 137].filter(c => c !== chainId);
      for (const altChainId of fallbackChains) {
        try {
          const { signature } = await walletStore.signPersonalMessage(from, rawMsg, altChainId);
          console.log('✅ [personal_sign] Signed via fallback chain:', altChainId);
          return signature;
        } catch { /* try next */ }
      }
      throw e;
    }
  },

  async eth_signTypedData_v4(params) {
    const { walletStore, chainId, confirmDialog } = ctx;
    const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v);
    let from = params[0], typed = params[1];
    if (!isAddr(from) && isAddr(typed)) [from, typed] = [typed, from];

    console.log('🖊️ [signTypedData_v4] chainId:', chainId, 'from:', from);

    const ok = await confirmDialog('Sign typed data', `Sign structured data as ${from}?`);
    if (!ok) throw new Error('User rejected');

    const typedJson = typeof typed === 'string' ? typed : JSON.stringify(typed);

    try {
      const sig = await walletStore.signTypedDataV4(from, typedJson, chainId);
      console.log('✅ [signTypedData_v4] Signed on chain:', chainId);
      return sig;
    } catch (e) {
      console.warn('⚠️ [signTypedData_v4] Failed on chain', chainId, ':', e?.message, '— trying fallback');
      const fallbackChains = [781234, 56, 1, 137].filter(c => c !== chainId);
      for (const altChainId of fallbackChains) {
        try {
          const sig = await walletStore.signTypedDataV4(from, typedJson, altChainId);
          console.log('✅ [signTypedData_v4] Signed via fallback chain:', altChainId);
          return sig;
        } catch { /* try next */ }
      }
      throw e;
    }
  },
});

