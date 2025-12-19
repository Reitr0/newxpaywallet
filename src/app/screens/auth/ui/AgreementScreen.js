// src/pages/home/ui/AgreementScreen.js
import React, { useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import VText from '@src/shared/ui/primitives/VText';
import VButton from '@src/shared/ui/primitives/VButton';
import VImage from '@src/shared/ui/primitives/VImage';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VBack from '@src/shared/ui/primitives/VBack';
import { View } from 'react-native';

export default function AgreementScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const isImport = route?.params?.isImport === true;

  const [checked, setChecked] = useState({
    item1: false,
    item2: false,
    item3: false,
  });

  const allChecked = useMemo(
    () => checked.item1 && checked.item2 && checked.item3,
    [checked]
  );

  const toggle = (key) =>
    setChecked((s) => ({
      ...s,
      [key]: !s[key],
    }));

  const onContinue = () => {
    const next = isImport ? 'ImportMnemonicScreen' : 'MnemonicScreen';
    navigation.navigate(next);
  };

  return (
    <View className="flex-1 bg-app">
      <View className={'w-full h-8 px-2'}>
        <VBack/>
      </View>
      <View className={'flex-1 px-4'}>
        {/* Hero / Illustration */}
        <View className="items-center mt-2 mb-8 flex-1">
          <VImage
            source={require('@src/assets/images/start/agreement.png')}
            className="w-full h-full"
            resizeMode="contain"
            accessibilityLabel={t('agreementScreen.secret_phrase_title')}
          />
        </View>

        {/* Title & description */}
        <VText variant="title" className="text-xl font-semibold text-center mb-3">
          {t('agreementScreen.secret_phrase_title')}
        </VText>
        <VText variant="body" className="text-base text-center mb-8">
          {t('agreementScreen.instructions')}
        </VText>

        {/* Check items */}
        <View className="gap-3">
          {(['item1', 'item2', 'item3']).map((k, idx) => {
            const label = t(`agreementScreen.checkbox${idx + 1}`);
            const checkedNow = checked[k];
            return (
              <View key={k}
                    className="flex-row items-center rounded-lg px-4 py-3 bg-item"
              >
                <VPressable
                  onPress={() => toggle(k)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: checkedNow }}
                  accessibilityLabel={label}
                  pressedClassName="opacity-80"
                >
                  <VIcon
                    name={checkedNow ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    className="text-title"
                  />

                </VPressable>
                <View className={'px-3'}>
                  <VText variant="body" className="mr-3">
                    {label}
                  </VText>
                </View>

              </View>

            );
          })}
        </View>

        {/* Continue Button */}
        <View className="mt-10">
          {VButton ? (
            <VButton
              variant="primary"
              title={t('agreementScreen.continue')}
              onPress={onContinue}
              disabled={!allChecked}
              className={!allChecked ? 'opacity-50' : ''}
              accessibilityHint={t('agreementScreen.continue')}
            />
          ) : (
            <VPressable
              className={`rounded-full py-4 items-center ${
                allChecked ? 'bg-btn-primary-bg' : 'bg-gray-400 opacity-50'
              }`}
              pressedClassName="bg-btn-primary-press"
              onPress={onContinue}
              accessibilityHint={t('agreementScreen.continue')}
              disabled={!allChecked}
            >
              <VText
                variant="button"
                className={allChecked ? 'text-btn-primary-text' : 'text-muted'}
              >
                {t('agreementScreen.continue')}
              </VText>
            </VPressable>
          )}
        </View>
      </View>

    </View>
  );
}
