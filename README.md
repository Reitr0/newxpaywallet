2) Wallet interfaces

5) Service/adapter shape (per chain)

Each chain implements the same IWallet by composing its driver pieces:

EvmWallet
├─ evmKeyAgent (ethers Wallet)
├─ evmNetwork  (ethers Provider)
└─ tokenDriver (erc20 read/tx helpers)

BtcWallet
├─ btcKeyAgent  (BIP32 + signer)
├─ btcNetwork   (UTXO provider + broadcaster)
└─ psbtBuilder

SolWallet
├─ solKeyAgent  (@solana/web3.js Keypair)
├─ solNetwork   (Connection)
└─ splDriver

TronWallet
├─ tronKeyAgent (secp256k1)
├─ tronNetwork  (TronWeb/HTTP RPC)
└─ trc20Driver


3) Minimal scaffolding (interfaces + base class)
   // src/wallets/BaseWallet.ts
   import { IWallet, IWalletInfo, IAccount, TxIntent, FeeQuote, Balance, SignedPayload, Capability } from '@/domain/IWallet';

export abstract class BaseWallet implements IWallet {
abstract info(): IWalletInfo;
abstract capabilities(): Capability;

abstract listAccounts(): Promise<IAccount[]>;
abstract useAccount(index: number): Promise<void>;
abstract activeAccount(): Promise<IAccount>;

abstract getNativeBalance(): Promise<Balance>;
abstract getTokenBalance(token: string): Promise<Balance>;

abstract estimate(intent: TxIntent): Promise<FeeQuote>;
abstract build(intent: TxIntent): Promise<Uint8Array>;
abstract sign(built: Uint8Array): Promise<SignedPayload>;
abstract send(signed: SignedPayload): Promise<string>;

async submit(intent: TxIntent) {
const built = await this.build(intent);
const signed = await this.sign(built);
const txid = await this.send(signed);
return { txid };
}

abstract signMessage(message: Uint8Array | string, opts?: any): Promise<SignedPayload>;
abstract on(event: 'accountChanged' | 'networkChanged' | 'txMined', cb: (p: any) => void): () => void;
}
4) Example: EVM adapter (concise but real)
   // src/wallets/evm/EvmWallet.ts
   import { ethers } from 'ethers';
   import { BaseWallet } from '../BaseWallet';
   import { IWalletInfo, Capability, TxIntent, FeeQuote, Balance, SignedPayload, Address } from '@/domain/IWallet';

type EvmDeps = {
rpcUrl: string;
chainId: ChainId;      // 'eth-mainnet' | ...
symbol: string;        // 'ETH'
decimals: number;      // 18
explorerBaseUrl: string;
getPrivateKey: (index: number) => Promise<string>; // from your KeyAgent
};

export class EvmWallet extends BaseWallet {
private provider: ethers.JsonRpcProvider;
private wallet!: ethers.Wallet;
private acctIndex = 0;
constructor(private deps: EvmDeps) {
super();
this.provider = new ethers.JsonRpcProvider(deps.rpcUrl);
}

info(): IWalletInfo {
const { chainId, symbol, decimals, explorerBaseUrl } = this.deps;
return { chainId, kind: 'EVM', label: 'EVM', symbol, decimals, explorerBaseUrl };
}

capabilities(): Capability {
return {
nativeTransfer: true,
tokenTransfer: true,
contractCall: true,
psbt: false,
messageSign: ['personal', 'typedData']
};
}

async initWallet() {
const pk = await this.deps.getPrivateKey(this.acctIndex);
this.wallet = new ethers.Wallet(pk, this.provider);
}

async listAccounts() {
// If you support multiple accounts, derive on demand; for demo return active only
const addr = await this.getAddress(this.acctIndex);
return [{ index: this.acctIndex, address: addr }];
}

async useAccount(index: number) {
this.acctIndex = index;
await this.initWallet();
}

async activeAccount() {
const addr = await this.getAddress(this.acctIndex);
return { index: this.acctIndex, address: addr };
}

private async getAddress(index: number): Promise<Address> {
const pk = await this.deps.getPrivateKey(index);
return new ethers.Wallet(pk).address;
}

async getNativeBalance(): Promise<Balance> {
if (!this.wallet) await this.initWallet();
const wei = await this.provider.getBalance(this.wallet.address);
return { total: ethers.formatEther(wei), decimals: this.deps.decimals, symbol: this.deps.symbol };
}

async getTokenBalance(token: string): Promise<Balance> {
if (!this.wallet) await this.initWallet();
const erc20 = new ethers.Contract(token, [
'function balanceOf(address) view returns (uint256)',
'function decimals() view returns (uint8)',
'function symbol() view returns (string)'
], this.provider);
const [raw, decimals, symbol] = await Promise.all([
erc20.balanceOf(this.wallet.address),
erc20.decimals(),
erc20.symbol()
]);
return { total: ethers.formatUnits(raw, decimals), decimals, symbol };
}

async estimate(intent: TxIntent): Promise<FeeQuote> {
if (!this.wallet) await this.initWallet();
if (intent.kind === 'nativeTransfer' || intent.kind === 'contractCall' || intent.kind === 'tokenTransfer') {
const txReq = await this.toEvmTxReq(intent);
const [gas, fee] = await Promise.all([
this.provider.estimateGas({ ...txReq, from: this.wallet.address }),
this.provider.getFeeData()
]);
const maxFeePerGas = fee.maxFeePerGas ?? fee.gasPrice!;
const feeEth = ethers.formatEther(maxFeePerGas * gas);
return { fee: feeEth, unitLabel: this.deps.symbol, details: { gasLimit: gas.toString(), maxFeePerGas: maxFeePerGas.toString() } };
}
throw new WalletError('NOT_SUPPORTED', 'Intent not supported on EVM');
}

async build(intent: TxIntent): Promise<Uint8Array> {
if (!this.wallet) await this.initWallet();
const txReq = await this.toEvmTxReq(intent);
const populated = await this.wallet.populateTransaction(txReq);
// Return RLP-encoded unsigned tx bytes
const ser = ethers.Transaction.from(populated).unsignedSerialized;
return ethers.getBytes(ser);
}

async sign(unsignedBytes: Uint8Array): Promise<SignedPayload> {
if (!this.wallet) await this.initWallet();
const unsigned = ethers.Transaction.from(unsignedBytes);
const signed = await this.wallet.signTransaction(unsigned);
return { kind: 'tx', raw: signed };
}

async send(signed: SignedPayload): Promise<string> {
if (signed.kind !== 'tx') throw new WalletError('NOT_SUPPORTED', 'Only tx payloads are sendable on EVM');
const resp = await this.provider.sendTransaction(signed.raw as Hex);
return resp.hash;
}

async signMessage(message: Uint8Array | string): Promise<SignedPayload> {
if (!this.wallet) await this.initWallet();
const sig = typeof message === 'string'
? await this.wallet.signMessage(message)
: await this.wallet.signMessage(message);
return { kind: 'message', signature: sig };
}

on(event: 'accountChanged' | 'networkChanged' | 'txMined', cb: (p: any) => void) {
if (event === 'txMined') {
const handler = (txHash: string) => cb({ txHash });
// consumer can wire provider.on('block', ...) externally; keeping minimal here
return () => { /* unsubscribe */ };
}
return () => {};
}

// --- helpers
private async toEvmTxReq(intent: TxIntent) {
if (!this.wallet) await this.initWallet();
switch (intent.kind) {
case 'nativeTransfer':
return { to: intent.to, value: ethers.parseEther(String(intent.amount)) };
case 'tokenTransfer': {
const erc20 = new ethers.Interface(['function transfer(address,uint256) returns (bool)']);
const data = erc20.encodeFunctionData('transfer', [intent.to, intent.amount]);
return { to: intent.token, data };
}
case 'contractCall':
return { to: intent.to, data: intent.data, value: intent.value ? ethers.toBeHex(intent.value) : undefined };
default:
throw new WalletError('NOT_SUPPORTED', `Unsupported intent for EVM: ${intent.kind}`);
}
}
}

5) Key management contract (pluggable)
   // src/domain/IKeyVault.ts
   export interface IKeyVault {
   // master seed lives in OS secure storage; derivation is per-chain path
   getPrivateKey(opts: { chain: ChainKind; index: number }): Promise<Uint8Array | string>;
   // (Optional) export/reveal mnemonic under biometric gate for backup
   exportMnemonic?(): Promise<string>;
   }
