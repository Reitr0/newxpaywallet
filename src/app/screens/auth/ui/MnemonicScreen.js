import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { generateMnemonic } from '@scure/bip39';
import { wordlist as en } from '@scure/bip39/wordlists/english';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VButton from '@src/shared/ui/primitives/VButton';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';

// If you already have a route to push next, keep this name consistent:
const NEXT_ROUTE = 'ConfirmMnemonicScreen';

export default function MnemonicScreen({ navigation }) {
  const { t } = useTranslation();

  const [mnemonic, setMnemonic] = useState('');
  const [hidden, setHidden] = useState(true);
  const [ack, setAck] = useState(false);
  const [strength, setStrength] = useState(128); // 128=12 words, 256=24 words

  // Generate on first mount (and when strength changes)
  useEffect(() => {
    try {
      const m = generateMnemonic(en, strength);
      setMnemonic(m);
      // Reset state each re-gen
      setHidden(true);
      setAck(false);
    } catch (_) {
      // no-op; you can add logService.error if you want
    }
  }, [strength]);

  const words = useMemo(
    () => (mnemonic ? mnemonic.trim().split(/\s+/) : []),
    [mnemonic]
  );

  // Highlight chips based on user's chosen strength (instant)
  const active12 = strength === 128;
  const active24 = strength === 256;

  const onToggleHidden = () => setHidden((v) => !v);
  const onToggleAck = () => setAck((v) => !v);

  const onCopy = async () => {
    try {
      const Clipboard = (await import('@react-native-clipboard/clipboard')).default;
      Clipboard.setString(mnemonic);
    } catch (_) {}
  };

  const onContinue = () => {
    if (!ack) return;
    navigation.navigate(NEXT_ROUTE, { mnemonic });
  };

  return (
    <View className="flex-1 bg-app">
      <View className="w-full h-8 px-2">
        <VBack />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title & description */}
        <VText variant="title" className="text-2xl font-semibold text-center mb-2">
          {t('mnemonicScreen.title', 'Your secret recovery phrase')}
        </VText>
        <VText variant="body" className="text-center text-muted mb-6">
          {t(
            'mnemonicScreen.subtitle',
            'Write these words down in order. Keep them safe and never share them with anyone.'
          )}
        </VText>

        {/* Word count toggle */}
        <View className="flex-row items-center justify-center gap-3 mb-4">
          <VPressable
            onPress={() => setStrength(128)}
            className={`px-3 py-2 rounded-full border ${
              active12 ? 'bg-link border-link' : 'bg-item border-border-subtle'
            }`}
            accessibilityRole="button"
            accessibilityLabel={t('mnemonicScreen.twelveWords', '12 words')}
          >
            <VText className={active12 ? 'text-inverse font-semibold' : 'text-title'}>
              {t('mnemonicScreen.twelveWords', '12 words')}
            </VText>
          </VPressable>

          <VPressable
            onPress={() => setStrength(256)}
            className={`px-3 py-2 rounded-full border ${
              active24 ? 'bg-link border-link' : 'bg-item border-border-subtle'
            }`}
            accessibilityRole="button"
            accessibilityLabel={t('mnemonicScreen.twentyFourWords', '24 words')}
          >
            <VText className={active24 ? 'text-inverse font-semibold' : 'text-title'}>
              {t('mnemonicScreen.twentyFourWords', '24 words')}
            </VText>
          </VPressable>
        </View>

        {/* Visibility + Copy controls */}
        <View className="flex-row items-center justify-center gap-3 mb-4">
          <VPressable
            onPress={onToggleHidden}
            className="px-3 py-2 rounded-full bg-item border border-border-subtle"
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? t('mnemonicScreen.reveal', 'Reveal') : t('mnemonicScreen.hide', 'Hide')
            }
          >
            <View className="flex-row items-center">
              <VIcon
                type="MaterialCommunityIcons"
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                className="text-title mr-2"
              />
              <VText>
                {hidden ? t('mnemonicScreen.reveal', 'Reveal') : t('mnemonicScreen.hide', 'Hide')}
              </VText>
            </View>
          </VPressable>

          <VPressable
            onPress={onCopy}
            className="px-3 py-2 rounded-full bg-item border border-border-subtle"
            accessibilityRole="button"
            accessibilityLabel={t('common.copy', 'Copy')}
          >
            <View className="flex-row items-center">
              <VIcon
                type="MaterialCommunityIcons"
                name="content-copy"
                size={18}
                className="text-title mr-2"
              />
              <VText>{t('common.copy', 'Copy')}</VText>
            </View>
          </VPressable>
        </View>

        {/* Words grid */}
        <View className="rounded-2xl p-4 bg-elevated border border-border-subtle">
          <View className="flex-row flex-wrap -mx-1">
            {words.map((w, i) => (
              <View key={`${i}-${w}`} className="w-1/2 md:w-1/3 px-1 py-1">
                <View className={`flex-row items-center px-3 ${active12 ? 'py-4' : 'py-2'} rounded-lg bg-item`}>
                  <VText className="w-8 text-muted tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </VText>
                  <VText className="ml-2 font-semibold text-title">
                    {hidden ? '••••••' : w}
                  </VText>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Acknowledgement */}
        <VPressable
          onPress={onToggleAck}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ack }}
          className="mt-6 flex-row items-start gap-3"
        >
          <View
            className={[
              'w-5 h-5 rounded border items-center justify-center mt-0.5',
              ack ? 'bg-link border-link' : 'bg-app border-border-subtle',
            ].join(' ')}
          >
            {ack ? (
              <VIcon type="MaterialCommunityIcons" name="check" size={16} className="text-inverse" />
            ) : null}
          </View>
          <VText className="flex-1 text-body">
            {t(
              'mnemonicScreen.ackText',
              'I wrote down the 12/24 words in order and will store them securely offline.'
            )}
          </VText>
        </VPressable>

        {/* Continue */}
        <View className="mt-8">
          <VButton
            variant="primary"
            title={t('common.continue', 'Continue')}
            onPress={onContinue}
            disabled={!ack}
            className={!ack ? 'opacity-50' : ''}
          />
        </View>

        {/* Safety note */}
        <VText className="mt-4 text-center text-muted text-xs px-3">
          {t(
            'mnemonicScreen.safety',
            'Never share your recovery phrase. Anyone with these words can access your funds.'
          )}
        </VText>
      </ScrollView>
    </View>
  );
}
