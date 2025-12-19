// services/crypto/bip39.js
import QuickCrypto from 'react-native-quick-crypto';

/**
 * BIP39 helper functions.
 * Converts mnemonic → seed using PBKDF2 (HMAC-SHA512).
 * SECURITY: never log raw mnemonic or seed.
 */
export const bip39Service = {
  mnemonicToSeed(mnemonic, passphrase = "") {
    try {
      // eslint-disable-next-line no-undef
      const mnemonicBuffer = Buffer.from(mnemonic, "utf8");
      // eslint-disable-next-line no-undef
      const saltBuffer = Buffer.from(`mnemonic${passphrase}`, "utf8");

      const iterations = 2048;
      const keyLength = 64;
      const algorithm = "sha512";



      return QuickCrypto.pbkdf2Sync(
        mnemonicBuffer,
        saltBuffer,
        iterations,
        keyLength,
        algorithm
      );
    } catch (error) {
      throw error;
    }
  },
};
