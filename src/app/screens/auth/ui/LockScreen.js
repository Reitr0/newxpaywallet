// src/app/screens/auth/ui/LockScreen.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { authStore } from '@src/features/auth/state/authStore';
import { useBiometric } from '@src/app/screens/auth/hooks/useBiometric';

import VIcon from '@src/shared/ui/atoms/VIcon';
import VText from '@src/shared/ui/primitives/VText';
import VBack from '@src/shared/ui/primitives/VBack';
import VPressable from '@src/shared/ui/primitives/VPressable';
import logService from '@src/shared/infra/log/logService';

/* ------------------------------------------------
 * Config
 * ------------------------------------------------ */
const PIN_LENGTH = 6;

/* ------------------------------------------------
 * Small UI atoms
 * ------------------------------------------------ */

function PinDots({ len = PIN_LENGTH, value = '' }) {
  return (
    <View className="flex-row mb-8">
      {Array.from({ length: len }).map((_, i) => {
        const filled = value.length > i;
        return (
          <View
            key={i}
            className={[
              'w-12 h-12 mx-2 rounded-lg border items-center justify-center',
              filled ? 'border-focus bg-elevated' : 'border-border-strong bg-app',
            ].join(' ')}
          >
            {filled ? <View className="w-2 h-2 rounded-full bg-title" /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Key({ label, onPress, icon, size = 24, accessibilityLabel }) {
  return (
    <View className="w-[30%] h-24 justify-center items-center mb-2">
      <VPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        onPress={onPress}
        className="w-20 h-20 rounded-full items-center justify-center bg-button-bg active:bg-btn-secondary-press"
      >
        {icon ? (
          <VIcon
            type="MaterialCommunityIcons"
            name={icon}
            size={size}
            className="text-title"
          />
        ) : (
          <VText variant="number" className="text-title text-4xl">
            {label}
          </VText>
        )}
      </VPressable>
    </View>
  );
}

function Keypad({ onDigit, onBackspace, onBiometric }) {
  return (
    <View className="flex-wrap flex-row justify-center w-4/5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
        <Key key={n} label={n} onPress={() => onDigit(n)} />
      ))}
      <Key
        label="fingerprint"
        icon="fingerprint"
        onPress={onBiometric}
        accessibilityLabel="Biometric"
        size={32}
      />
      <Key label="0" onPress={() => onDigit('0')} />
      <Key
        label="backspace"
        icon="backspace-outline"
        onPress={onBackspace}
        accessibilityLabel="Delete"
        size={32}
      />
    </View>
  );
}

/* ------------------------------------------------
 * Screen
 * ------------------------------------------------ */

export default function LockScreen({ navigation, route }) {
  const { t } = useTranslation();
  const snap = useSnapshot(authStore);

  // Params
  const { showHeader = true, onCallBack } = route?.params || {};
  const routeMode = route?.params?.mode ?? 'enter';

  // Local state (synced with routeMode)
  const [mode, setMode] = useState(routeMode);
  const [pin, setPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(routeMode === 'setting');
  const [isConfirmingPin, setIsConfirmingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');

  const { simplePrompt, isSensorAvailable } = useBiometric();

  // Keep local mode & flags in sync with navigation param
  useEffect(() => {
    setMode(routeMode);
    setIsSettingPin(routeMode === 'setting');
    setIsConfirmingPin(false);
    setNewPin('');
    setPin('');
    setError('');
  }, [routeMode]);

  // Init PIN (hydrates lock state & ensures locked if a PIN exists)
  useEffect(() => {
    (async () => {
      try {
        await authStore.initializePin();
      } catch (e) {
        logService.error('authStore.initializePin failed', { message: e?.message });
      }
    })();
  }, []);

  // Auto biometric on supported modes
  useEffect(() => {
    let backSub;
    (async () => {
      if ((mode === 'enter' || mode === 'change' || mode === 'lock') && snap.biometricEnabled) {
        await handleBiometricAuth();
      }
      if (!showHeader) {
        backSub = BackHandler.addEventListener('hardwareBackPress', () => true);
      }
    })();
    return () => {
      backSub?.remove?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showHeader, snap.biometricEnabled]);

  const title = useMemo(() => {
    if (isSettingPin) {
      return isConfirmingPin ? t('lockScreen.confirmPin') : t('lockScreen.createPin');
    }
    if (mode === 'lock') return t('lockScreen.unlock');
    if (mode === 'change') return t('lockScreen.enterCurrentPin');
    return t('lockScreen.enterPin');
  }, [isSettingPin, isConfirmingPin, mode, t]);

  const handleBiometricAuth = useCallback(async () => {
    try {
      const { available } = await isSensorAvailable();
      if (!available) return;

      const result = await simplePrompt(t('lockScreen.biometricPrompt'));
      if (result.success) {
        authStore.unlock();
        onCallBack?.();
      }
    } catch (e) {
      logService.warn('Biometric auth failed', { message: e?.message });
    }
  }, [isSensorAvailable, simplePrompt, onCallBack, t]);

  const resetErrors = () => setError('');

  const onDigit = (d) => {
    resetErrors();
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      setTimeout(() => finalizePin(next), 50);
    }
  };

  const onBackspace = () => {
    resetErrors();
    setPin((p) => p.slice(0, -1));
  };

  const finalizePin = async (entered) => {
    try {
      if (isSettingPin) {
        // creating a new PIN (always 6 digits)
        if (isConfirmingPin) {
          if (entered === newPin) {
            const result = await authStore.setPin(entered);
            if (result === 'success') {
              setIsSettingPin(false);
              setIsConfirmingPin(false);
              setPin('');
              onCallBack?.();
            } else {
              setError(t('lockScreen.genericError'));
              setPin('');
            }
          } else {
            setError(t('lockScreen.pinMismatch', 'PINs do not match. Try again.'));
            setPin('');
            setNewPin('');
            setIsConfirmingPin(false);
          }
        } else {
          setNewPin(entered);
          setPin('');
          setIsConfirmingPin(true);
        }
        return;
      }

      // not setting; either change/lock/enter
      if (mode === 'change') {
        if (authStore.authenticate(entered)) {
          setIsSettingPin(true);
          setPin('');
          setError('');
        } else {
          setError(t('lockScreen.incorrectPin', 'Incorrect passcode'));
          setPin('');
        }
        return;
      }

      if (mode === 'lock') {
        if (authStore.authenticate(entered)) {
          onCallBack?.();
          setMode('enter');
          setPin('');
        } else {
          setError(t('lockScreen.incorrectPin', 'Incorrect passcode'));
          setPin('');
        }
        return;
      }

      // mode === 'enter'
      if (authStore.authenticate(entered)) {
        onCallBack?.();
        setPin('');
      } else {
        setError(t('lockScreen.incorrectPin', 'Incorrect passcode'));
        setPin('');
      }
    } catch (e) {
      logService.error('finalizePin error', { message: e?.message });
      setError(t('lockScreen.genericError'));
      setPin('');
    }
  };

  return (
    <View className="flex-1 bg-app">
      {showHeader && (
        <View className="w-full h-8 px-2">
          <VBack />
        </View>
      )}

      <View className="flex-1 justify-center items-center px-6">
        <VText variant="title" className="text-title text-xl font-semibold mb-6">
          {title}
        </VText>

        <PinDots value={pin} />

        <View className="h-14">
          <VText variant="body" className="text-muted text-center">
            {isSettingPin && !isConfirmingPin
              ? t(
                'lockScreen.passcodeCreateHint',
                'Enter your passcode. Be sure to remember it so you can unlock your wallet.'
              )
              : isSettingPin && isConfirmingPin
                ? t('lockScreen.passcodeConfirmHint', 'Re-enter the passcode to confirm.')
                : t('lockScreen.passcodeInfo')}
          </VText>
        </View>

        {error ? (
          <VText variant="body" className="text-danger mb-2">
            {error}
          </VText>
        ) : null}

        <Keypad onDigit={onDigit} onBackspace={onBackspace} onBiometric={handleBiometricAuth} />
      </View>
    </View>
  );
}
