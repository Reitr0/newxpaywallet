// src/pages/home/ui/StartScreen.js
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import VButton from '@src/shared/ui/primitives/VButton';
import VText from '@src/shared/ui/primitives/VText';
import VImage from '@src/shared/ui/primitives/VImage';

export default function StartScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const goAuthThen = (isImport) => {
    navigation.navigate('LockScreen', {
      mode: 'setting',
      showHeader: true,
      onCallBack: () => {
        navigation.navigate('AgreementScreen', { isImport: false });
      },
    });
  };

  const goToImportMnemonic = () => {
    navigation.navigate('LockScreen', {
      mode: 'setting',
      showHeader: true,
      onCallBack: () => {
        navigation.navigate('ImportMnemonicScreen'); // Direct navigation
      },
    });
  };

  return (
    <View className="flex-1 bg-app justify-between">
      {/* Main Content */}
      <View className="justify-end mt-12 px-6 flex-1 mb-8">
        {/* Cube image */}
        <View className="w-full h-96 items-center justify-center ">
          <VImage source={require('@src/assets/images/start/cube.png')} className={'w-full h-full'} />
        </View>
        {/* Headline */}
        <View className="mt-10 self-start w-full">
          <VText className="text-[45px] font-bold leading-snug">
            {t('startScreen.line1', 'Earn rewards,')}
          </VText>
          <VText className="text-[45px] font-bold leading-snug">
            {t('startScreen.line2', 'buy crypto,')}
          </VText>
          <VText className="text-[45px] font-bold leading-snug">
            {t('startScreen.line3', 'swap tokens')}
          </VText>
        </View>
      </View>

      {/* Footer */}
      <View className="px-6 pb-6">
        {/* Primary Button - Create new wallet */}
        <VButton
          variant="primary"
          title={t('createScreen.createWalletButton', 'Create new wallet')}
          onPress={() => goAuthThen(false)}
          className="mb-3"
        />

        {/* Secondary Button - Import existing wallet */}
        <VButton
          variant="secondary"
          title={t('wallet.import', 'I already have a wallet')}
          onPress={goToImportMnemonic} // Updated handler
          className="mb-5"
        />

        {/* Legal disclaimer */}
        <VText
          variant="body"
          className="text-xs text-center text-muted px-4 leading-relaxed"
        >
          {t('startScreen.legalPrefix', 'By tapping any button you agree and consent to our')}
          {'\n'}
          <VText variant="link">{t('startScreen.terms', 'Terms of Service')}</VText>{' '}
          {t('startScreen.and', 'and')}{' '}
          <VText variant="link">{t('startScreen.privacy', 'Privacy Policy')}</VText>.
        </VText>
      </View>
    </View>
  );
}