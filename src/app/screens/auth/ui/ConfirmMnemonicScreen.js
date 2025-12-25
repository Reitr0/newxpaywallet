// src/pages/home/ui/ConfirmMnemonicScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VButton from '@src/shared/ui/primitives/VButton';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';

import { authStore } from '@src/features/auth/state/authStore';
import { walletStore } from '@features/wallet/state/walletStore';

/** Fisher–Yates shuffle */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * ConfirmMnemonicScreen
 * Props: navigation, route (passed automatically by React Navigation)
 */
export default function ConfirmMnemonicScreen({ navigation, route }) {
  const { t } = useTranslation();

  const mnemonic = route?.params?.mnemonic?.trim() || '';
  const words = useMemo(() => (mnemonic ? mnemonic.split(/\s+/).filter(Boolean) : []), [mnemonic]);

  const [pool, setPool] = useState([]);           // shuffled items
  const [selected, setSelected] = useState([]);   // indices in pool
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize shuffled pool
  useEffect(() => {
    if (!words.length) return;

    const shuffled = shuffle(words).map((word, idx) => ({
      word,
      originalIndex: words.indexOf(word),
      poolIndex: idx,
    }));

    setPool(shuffled);
    setSelected([]);
    setError('');
  }, [words]);

  // Validation
  const isCorrectPrefix = useCallback((selectedIndices, poolArray, originalWords) => {
    return selectedIndices.every((poolIdx, pos) => {
      const item = poolArray[poolIdx];
      return item && originalWords[pos] === item.word;
    });
  }, []);

  const remainingCount = words.length - selected.length;
  const isCorrectSoFar = useMemo(
    () => isCorrectPrefix(selected, pool, words),
    [selected, pool, words, isCorrectPrefix]
  );

  const doneAndCorrect = selected.length === words.length && isCorrectSoFar;

  const onPickFromPool = useCallback(
    (poolIdx) => {
      if (selected.includes(poolIdx)) return;

      const next = [...selected, poolIdx];
      setSelected(next);

      if (!isCorrectPrefix(next, pool, words)) {
        setError(t('confirmMnemonic.mismatch', 'Wrong order. Tap a selected word to remove it.'));
      } else {
        setError('');
      }
    },
    [selected, pool, words, isCorrectPrefix, t]
  );

  const onRemoveFromSelected = useCallback(
    (idxInSelected) => {
      const next = selected.filter((_, i) => i !== idxInSelected);
      setSelected(next);
      if (isCorrectPrefix(next, pool, words)) setError('');
    },
    [selected, pool, words, isCorrectPrefix]
  );

  const onReset = () => {
    setSelected([]);
    setError('');
  };

  const onShuffle = () => {
    if (!words.length) return;
    const shuffled = shuffle(pool);
    setPool(shuffled);
    setSelected([]);
    setError('');
  };

  const onConfirm = () => {
    if (!doneAndCorrect || submitting) return;

    Alert.alert(
      t('confirmMnemonic.finalCheck', 'Final Confirmation'),
      t('confirmMnemonic.irreversible', 'This will create your wallet permanently. Are you 100% sure?'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              setError('');

              // USE THE REAL USER MNEMONIC
              await walletStore.init(mnemonic);

              // Onboarding complete
              authStore.setHasWallet(true);
              authStore.markAcceptedTos?.();
              authStore.unlock?.();
              authStore.setAuthenticated(true);
            } catch (err) {
              console.error('Wallet init failed:', err);
              setError(
                err?.message ||
                  t('confirmMnemonic.initFailed', 'Failed to create wallet. Please try again.')
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  // Block back button during submission
  useEffect(() => {
    if (submitting) {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (submitting) {
          e.preventDefault();
        }
      });
      return unsubscribe;
    }
  }, [navigation, submitting]);

  // Invalid mnemonic
  const validLength = words.length === 12 || words.length === 24;
  if (!mnemonic || !validLength) {
    return (
      <View className="flex-1 bg-app pt-8">
        <View className="w-full h-8 px-2">
          <VBack onPress={() => navigation.goBack()} />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <VText className="text-danger text-center text-lg font-bold">
            {t('confirmMnemonic.invalid', 'Invalid recovery phrase')}
          </VText>
          <VText className="text-muted text-center mt-4">
            {t('confirmMnemonic.goBack', 'Please go back and generate a new one.')}
          </VText>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app">
      <View className="w-full h-8 px-2">
        <VBack onPress={() => navigation.goBack()} disabled={submitting} />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <VText variant="title" className="text-2xl font-bold text-center mb-2">
          {t('confirmMnemonic.title', 'Confirm Recovery Phrase')}
        </VText>
        <VText variant="body" className="text-center text-muted mb-8">
          {t('confirmMnemonic.subtitle', 'Tap the words in the correct order')}
        </VText>

        {/* Selected Words */}
        <View className="mb-6">
          <View className="rounded-2xl p-4 min-h-[110px] bg-elevated border border-border-subtle">
            {selected.length === 0 ? (
              <VText className="text-muted text-center italic">
                {t('confirmMnemonic.startTapping', 'Tap words below to begin...')}
              </VText>
            ) : (
              <View className="flex-row flex-wrap justify-center gap-2">
                {selected.map((poolIdx, pos) => {
                  const { word } = pool[poolIdx];
                  return (
                    <VPressable
                      key={`${poolIdx}-${pos}`}
                      onPress={() => onRemoveFromSelected(pos)}
                      disabled={submitting}
                      className="px-4 py-3 rounded-2xl bg-primary/10 border border-primary/30"
                    >
                      <View className="flex-row items-center gap-2">
                        <VText className="text-primary font-bold">
                          {String(pos + 1).padStart(2, '0')}
                        </VText>
                        <VText className="font-semibold text-title">{word}</VText>
                        <VIcon
                          type="MaterialCommunityIcons"
                          name="close-circle"
                          size={18}
                          className="text-primary"
                        />
                      </View>
                    </VPressable>
                  );
                })}
              </View>
            )}
          </View>

          <View className="flex-row justify-between items-center mt-4">
            <VText className="text-muted">
              {remainingCount > 0
                ? t('confirmMnemonic.remaining', '{{count}} words left', { count: remainingCount })
                : t('confirmMnemonic.complete', 'Complete!')}
            </VText>

            <View className="flex-row gap-3">
              <VPressable
                onPress={onReset}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-item border border-border-subtle"
              >
                <VText className="font-medium">{t('common.reset')}</VText>
              </VPressable>
              <VPressable
                onPress={onShuffle}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-item border border-border-subtle"
              >
                <VText className="font-medium">{t('common.shuffle')}</VText>
              </VPressable>
            </View>
          </View>

          {error ? <VText className="text-danger mt-3 text-center font-medium">{error}</VText> : null}
        </View>

        {/* Word Pool */}
        <View className="flex-row flex-wrap justify-center -m-1 mb-10">
          {pool.map(({ word, poolIndex }) => {
            const isPicked = selected.includes(poolIndex);
            return (
              <VPressable
                key={`${word}-${poolIndex}`}
                onPress={() => onPickFromPool(poolIndex)}
                disabled={isPicked || submitting}
                className={`
                  m-1 px-4 py-3 rounded-2xl border
                  ${isPicked
                    ? 'bg-muted/20 border-border-subtle opacity-50'
                    : 'bg-elevated border-border-subtle active:bg-primary/10'
                  }
                  ${submitting ? 'opacity-50' : ''}
                `}
              >
                <VText className={`font-semibold ${isPicked ? 'text-muted' : 'text-title'}`}>
                  {word}
                </VText>
              </VPressable>
            );
          })}
        </View>

        {/* Confirm Button */}
        <VButton
          variant="primary"
          size="large"
          title={
            submitting
              ? t('common.creatingWallet', 'Creating Wallet...')
              : t('common.confirmPhrase', 'Confirm Phrase')
          }
          onPress={onConfirm}
          disabled={!doneAndCorrect || submitting}
          loading={submitting}
        />

        <VText className="mt-6 text-center text-muted text-xs italic px-4">
          {t(
            'mnemonicScreen.warning',
            'Never share your recovery phrase. Anyone with these words can steal your funds.'
          )}
        </VText>
      </ScrollView>
    </View>
  );
}