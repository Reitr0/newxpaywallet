// src/entities/wallet/types.js

/**
 * @typedef {'EVM'|'BTC'|'SOL'|'TRON'} ChainKind
 * @typedef {'eth-mainnet'|'polygon'|'bsc'|'btc'|'btc-testnet'|'sol'|'sol-devnet'|'tron'} ChainId
 * @typedef {string} Address    // chain-specific address (0x.., bc1.., base58, T..)
 * @typedef {`0x${string}`} Hex // hex string starting with 0x
 * @typedef {string|bigint} Bigish // flexible numeric type
 */

/**
 * @typedef IWalletInfo
 * @property {ChainId} chainId
 * @property {ChainKind} kind
 * @property {string} label         // e.g. "Ethereum Mainnet"
 * @property {string} symbol        // e.g. "ETH"
 * @property {number} decimals      // native decimals (18 ETH, 9 SOL, 8 BTC)
 * @property {string} explorerBaseUrl
 */

/**
 * @typedef IAccount
 * @property {number} index
 * @property {Address} address
 */

/**
 * @typedef Balance
 * @property {string} total    // normalized string
 * @property {number} decimals
 * @property {string} symbol
 */

/**
 * @typedef FeeQuote
 * @property {string} fee
 * @property {string} unitLabel
 * @property {Record<string,any>} [details]
 */

/**
 * @typedef SignedPayload
 * @property {'tx'|'message'} kind
 * @property {Hex|string} [raw]
 * @property {Hex|string} [signature]
 * @property {any} [meta]
 */

/**
 * @typedef Capability
 * @property {boolean} nativeTransfer
 * @property {boolean} tokenTransfer
 * @property {boolean} contractCall
 * @property {boolean} psbt
 * @property {Array<'personal'|'typedData'|'rawBytes'|'solana'|'tron'>} messageSign
 */

/**
 * WalletError extends Error with a code
 */
export class WalletError extends Error {
  /**
   * @param {'NETWORK'|'INSUFFICIENT_FUNDS'|'INVALID_ADDRESS'|'REJECTED'|'TIMEOUT'|'NOT_SUPPORTED'|'INTERNAL'} code
   * @param {string} msg
   * @param {any} [cause]
   */
  constructor(code, msg, cause) {
    super(msg);
    this.code = code;
    this.cause = cause;
  }
}
