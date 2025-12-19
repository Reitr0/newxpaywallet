// src/features/browser/services/rpcHandlers/signHandlers.js
export const signHandlers = (ctx) => ({
  async personal_sign(params) {
    const { walletStore, chainId, activeAddr, confirmDialog } = ctx;
    let msg, from;
    const [a, b] = params;
    if (String(a).startsWith('0x') && a.length > 42) { msg = a; from = b; } else { from = a; msg = b; }

    if (!activeAddr || activeAddr.toLowerCase() !== String(from).toLowerCase())
      throw new Error('Invalid from address');

    const ok = await confirmDialog('Sign message', `Sign as ${from}?`);
    if (!ok) throw new Error('User rejected');

    // ensure correct encoding
    const isHex = msg.startsWith('0x');
    const rawMsg = isHex ? msg : '0x' + Buffer.from(msg, 'utf8').toString('hex');

    // must perform EIP-191 prefix internally
    const { signature } = await walletStore.signPersonalMessage(from, rawMsg, chainId);
    return signature;
  },

  async eth_signTypedData_v4(params) {
    const { walletStore, chainId, confirmDialog } = ctx;
    const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v);
    let from = params[0], typed = params[1];
    if (!isAddr(from) && isAddr(typed)) [from, typed] = [typed, from];

    const ok = await confirmDialog('Sign typed data', `Sign structured data as ${from}?`);
    if (!ok) throw new Error('User rejected');

    const typedJson = typeof typed === 'string' ? typed : JSON.stringify(typed);
    return await walletStore.signTypedDataV4(from, typedJson, chainId);
  },
});
