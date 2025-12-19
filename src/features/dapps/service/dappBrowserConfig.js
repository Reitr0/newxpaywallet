// src/features/browser/config/dappBrowserConfig.js

export const PROVIDER_ID   = 'vcoin';
export const PROVIDER_NAME = 'VCOIN';
export const PROVIDER_LOGO = 'https://vprice-68e717fd25a6.herokuapp.com/static/images/vcoin_wallet_logo.png';
export const HOME_BASE = 'https://vpocket.home/';
export const toHexChainId = (n) => '0x' + Number(n || 1).toString(16);
