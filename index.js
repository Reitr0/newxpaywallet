import "./global.css"
import './shim'
import 'react-native-get-random-values';
import crypto from 'react-native-quick-crypto';
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
import { polyfill as polyfillBase64 } from 'react-native-polyfill-globals/src/base64';
global.Buffer = global.Buffer || require('buffer').Buffer;
polyfillEncoding();
polyfillBase64();
/* global BigInt */
import { AppRegistry } from 'react-native';
import App from '@src/app/App';
import { name as appName } from './app.json';
import { ethers } from 'ethers';
import {enableScreens} from 'react-native-screens';
enableScreens();
ethers.randomBytes.register(length => {
  return new Uint8Array(crypto.randomBytes(length));
});

ethers.computeHmac.register((algo, key, data) => {
  return crypto.createHmac(algo, key).update(data).digest();
});

ethers.pbkdf2.register((passwd, salt, iter, keylen, algo) => {
  return crypto.pbkdf2Sync(passwd, salt, iter, keylen, algo);
});

ethers.sha256.register(data => {
  return crypto.createHash('sha256').update(data).digest();
});

ethers.sha512.register(data => {
  return crypto.createHash('sha512').update(data).digest();
});
AppRegistry.registerComponent(appName, () => App);
