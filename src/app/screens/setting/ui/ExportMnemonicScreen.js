// src/pages/security/ui/ExportMnemonicScreen.js
import React, { useMemo, useState, useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { walletStore } from '@features/wallet/state/walletStore';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';

export default function ExportMnemonicScreen({ navigation }) {
  const { t } = useTranslation();
  const { mnemonic } = useSnapshot(walletStore);

  const [hidden, setHidden] = useState(true);

  const words = useMemo(
    () => (mnemonic ? mnemonic.trim().split(/\s+/) : []),
    [mnemonic]
  );

  const count = words.length;
  const is12 = count === 12;
  const is24 = count === 24;

  const onToggleHidden = useCallback(() => setHidden(v => !v), []);
  const onCopy = useCallback(async () => {
    try {
      if (!mnemonic) return;
      const Clipboard = (await import('@react-native-clipboard/clipboard')).default;
      Clipboard.setString(mnemonic);
      snackbarStore.show(t('common.copied', 'Copied'), 'success');
    } catch (e) {
      snackbarStore.show(e?.message || String(e) || t('errors.unknown', 'Unknown error'), 'error');
    }
  }, [mnemonic, t]);

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="w-full h-8 px-2">
        <VBack onPress={() => navigation.pop(2)} />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title & description */}
        <VText variant="title" className="text-2xl font-semibold text-center mb-2">
          {t('exportMnemonicScreen.title', 'Your secret recovery phrase')}
        </VText>
        <VText variant="body" className="text-center text-muted mb-6">
          {t(
            'exportMnemonicScreen.subtitle',
            'Write these words down in order. Keep them safe and never share them with anyone.'
          )}
        </VText>

        {/* Word count badges */}
        <View className="flex-row items-center justify-center gap-3 mb-4">
          <VPressable
            disabled
            className={[
              'px-3 py-2 rounded-full border',
              is12 ? 'bg-link border-link' : 'bg-item border-border-subtle',
            ].join(' ')}
            accessibilityRole="text"
          >
            <VText className={is12 ? 'text-inverse' : 'text-title'}>
              {t('exportMnemonicScreen.twelveWords', '12 words')}
            </VText>
          </VPressable>

          <VPressable
            disabled
            className={[
              'px-3 py-2 rounded-full border',
              is24 ? 'bg-link border-link' : 'bg-item border-border-subtle',
            ].join(' ')}
            accessibilityRole="text"
          >
            <VText className={is24 ? 'text-inverse' : 'text-title'}>
              {t('exportMnemonicScreen.twentyFourWords', '24 words')}
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
              hidden
                ? t('exportMnemonicScreen.reveal', 'Reveal')
                : t('exportMnemonicScreen.hide', 'Hide')
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
                {hidden
                  ? t('exportMnemonicScreen.reveal', 'Reveal')
                  : t('exportMnemonicScreen.hide', 'Hide')}
              </VText>
            </View>
          </VPressable>

          <VPressable
            onPress={onCopy}
            disabled={!mnemonic}
            className={[
              'px-3 py-2 rounded-full border',
              mnemonic ? 'bg-item border-border-subtle' : 'bg-item border-border-subtle opacity-60',
            ].join(' ')}
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

        {/* Empty state */}
        {!mnemonic && (
          <View className="rounded-2xl p-4 bg-elevated border border-border-subtle items-center">
            <VText className="text-muted text-sm text-center">
              {t(
                'exportMnemonicScreen.empty',
                'No recovery phrase available. Create or import a wallet first.'
              )}
            </VText>
          </View>
        )}

        {/* Words grid */}
        {!!mnemonic && (
          <View className="rounded-2xl p-4 bg-elevated border border-border-subtle">
            <View className="flex-row flex-wrap -mx-1">
              {words.map((w, i) => (
                <View key={`${i}-${w}`} className="w-1/2 md:w-1/3 px-1 py-1">
                  <View className="flex-row items-center px-3 py-4 rounded-lg bg-item">
                    <VText className="w-8 text-muted">
                      {String(i + 1).padStart(2, '0')}
                    </VText>
                    <VText className="ml-2 font-semibold">
                      {hidden ? '••••••' : w}
                    </VText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Safety note */}
        <VText className="mt-4 text-center text-muted text-xs px-3">
          {t(
            'exportMnemonicScreen.safety',
            'Never share your recovery phrase. Anyone with these words can access your funds.'
          )}
        </VText>
      </ScrollView>
    </View>
  );
}
