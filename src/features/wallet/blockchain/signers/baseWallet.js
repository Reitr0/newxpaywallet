
/**
 * BaseWallet defines the contract that all chain adapters must follow.
 * Subclasses (EvmWallet, BtcWallet, SolWallet, TronWallet) must implement
 * the required methods, otherwise constructor throws in dev.
 */

const REQUIRED_METHODS = [
  'info',
  'capabilities',
  'listAccounts',
  'useAccount',
  'activeAccount',
  'getNativeBalance',
  'getTokenBalance',
  'estimate',
  'build',
  'sign',
  'send',
  'submit',
  'signMessage',
  'on'
];

export class BaseWallet {
  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this._assertImplements();
    }
  }

  _assertImplements() {
    const missing = [];
    for (const m of REQUIRED_METHODS) {
      if (typeof this[m] !== 'function') {
        missing.push(m);
      }
    }
    if (missing.length) {
      throw new Error(
        `Wallet implementation incomplete. Missing methods: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Default implementation: build -> sign -> send
   * Subclasses can override if needed.
   * @param {import('../../../../entities/tx/types.js').TxIntent} intent
   * @returns {Promise<{txid:string}>}
   */
  async submit(intent) {
    const built = await this.build(intent);
    const signed = await this.sign(built);
    const txid = await this.send(signed);
    return { txid };
  }

  /**
   * Default no-op event listener (override in subclasses)
   * @param {'accountChanged'|'networkChanged'|'txMined'} event
   * @param {(payload:any)=>void} cb
   * @returns {()=>void} unsubscribe fn
   */
  on(event, cb) {
    return () => {};
  }
}
