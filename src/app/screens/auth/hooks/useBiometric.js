// useBiometricService.js
import FingerprintScanner from 'react-native-fingerprint-scanner';

export const useBiometric = () => {
  const isSensorAvailable = async () => {
    try {
      const biometryType = await FingerprintScanner.isSensorAvailable();
      return {available: true, biometryType};
    } catch (error) {
      return {available: false, biometryType: null, error};
    }
  };

  const simplePrompt = async promptMessage => {
    try {
      await FingerprintScanner.authenticate({description: promptMessage});
      await FingerprintScanner.release();
      return {success: true};
    } catch (error) {
      return {success: false, error};
    }
  };

  return {
    isSensorAvailable,
    simplePrompt,
  };
};
