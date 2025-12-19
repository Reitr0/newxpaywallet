// src/features/onboarding/ui/ImportMnemonicScreen.jsx
import React, { useMemo, useState, useCallback} from 'react';
import { View, TextInput, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Clipboard from '@react-native-clipboard/clipboard';

import { validateMnemonic } from '@scure/bip39';
import { wordlist as en } from '@scure/bip39/wordlists/english';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VButton from '@src/shared/ui/primitives/VButton';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { authStore } from '@features/auth/state/authStore';
import { walletStore } from '@features/wallet/state/walletStore';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';

// Helpers
const normalizePhrase = (s = '') =>
  s
    .toLowerCase()
    .replace(/\u3000/g, ' ')        // full-width spaces -> normal
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();

const VALID_COUNTS = new Set([12, 15, 18, 21, 24]);

export default function ImportMnemonicScreen({ navigation }) {
  const { t } = useTranslation();

  const [name, setName] = useState('Main Wallet');
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const phrase = useMemo(() => normalizePhrase(input), [input]);
  const words = useMemo(() => (phrase ? phrase.split(' ') : []), [phrase]);
  const wordCount = words.length;

  const isCountOk = VALID_COUNTS.has(wordCount);
  const isValid = isCountOk && validateMnemonic(phrase, en);

  const borderClass =
    !touched ? 'border-border-subtle' : isValid ? 'border-success' : 'border-error';

  const onPaste = useCallback(async () => {
    try {
      const txt = await Clipboard.getString();
      if (txt) {
        setInput(normalizePhrase(txt));
        setTouched(true);
      }
    } catch(e) {
      snackbarStore.show(e.message || String(e), 'error')
    }
  }, []);

  const onRestore = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      walletStore.init(phrase).then(()=>{
        authStore.setHasWallet(true);
        authStore.markAcceptedTos?.();
        authStore.unlock?.();
        authStore.setAuthenticated(true)
      });
    } catch (e) {
      snackbarStore.show(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, phrase]);

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center justify-between px-3">
        <View className="w-12">
          <VBack />
        </View>
        <VText className="text-title text-lg font-semibold">
          {t('importMnemonic.title', 'Multi-coin wallet')}
        </VText>
        <View className={'w-10'} />
      </View>
      <View className="px-4 mt-2">
        {/* Wallet name */}
        <VText className="text-muted mb-2">
          {t('importMnemonic.walletName', 'Wallet name')}
        </VText>
        <View className="mb-4 rounded-2xl border bg-surface px-3 py-3 flex-row items-center">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('importMnemonic.walletNamePlaceholder', 'Main Wallet')}
            placeholderTextColor="#9AA4B2"
            className="flex-1 text-base text-foreground"
          />
          {!!name && (
            <VPressable onPress={() => setName('')} className="pl-2">
              <VIcon type="Feather" name="x-circle" size={18} className="text-muted" />
            </VPressable>
          )}
        </View>

        {/* Secret phrase */}
        <VText className="text-muted mb-2">
          {t('importMnemonic.secretPhrase', 'Secret phrase')}
        </VText>

        <View
          className={`rounded-2xl border ${borderClass} bg-app focus-within:border-link mb-2`}
        >
          <View className="px-3 pt-2 pb-1">
            <TextInput
              value={input}
              onChangeText={(v) => {
                setInput(v);
                if (!touched) setTouched(true);
              }}
              multiline
              numberOfLines={5}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('importMnemonic.placeholder', 'Enter your 12–24 words')}
              placeholderTextColor="#9AA4B2"
              className="text-base text-foreground min-h-[120px]"
            />
            <View className="flex-row justify-end">
              <VPressable onPress={onPaste} className="py-2 px-1">
                <VText className="text-link">{t('common.paste', 'Paste')}</VText>
              </VPressable>
            </View>
          </View>
        </View>

        {/* Hint / validation */}
        <VText className="text-center text-muted mb-6">
          {t(
            'importMnemonic.hint',
            'Typically 12 (sometimes 18, 24) words separated by single spaces'
          )}
        </VText>

        {/* Restore button */}
        <VButton
          variant="primary"
          title={t('importMnemonic.restore', 'Restore wallet')}
          onPress={onRestore}
          disabled={!isValid || submitting}
          className={!isValid || submitting ? 'opacity-50' : ''}
        />

        {/* Learn more */}
        <VPressable
          onPress={() => Linking.openURL('https://yourwallet.help/what-is-seed')}
          className="mt-5 items-center"
        >
          <VText className="text-link font-medium">
            {t('importMnemonic.whatIsSeed', 'What is a secret phrase?')}
          </VText>
        </VPressable>

        {/* Tiny live info */}
        <View className="mt-6 items-center">
          <VText className="text-xs text-muted">
            {wordCount
              ? t('importMnemonic.wordsCount', '{{count}} words', { count: wordCount })
              : ' '}
          </VText>
        </View>
      </View>
    </View>
  );
}
