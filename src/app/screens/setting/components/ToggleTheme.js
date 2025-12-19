import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VText from '@src/shared/ui/primitives/VText';
import VSwitch from '@src/shared/ui/primitives/VSwitch';
import { appearanceStore, useAppearance } from '@features/settings/appearance/state/appearanceStore';

export default function ToggleTheme() {
  const { t } = useTranslation();
  const { colorScheme } = useAppearance();
  const isDark = colorScheme === 'dark';

  // Dynamic icon + label
  const icon = isDark
    ? { name: 'moon', type: 'Feather' }
    : { name: 'sun', type: 'Feather' };

  const label = isDark
    ? t('appearanceScreen.dark') // e.g. "Light Mode"
    : t('appearanceScreen.light'); // e.g. "Dark Mode"

  return (
    <View className="flex-row items-center px-4 py-3 bg-surface">
      <VIcon {...icon} size={20} className="mr-3 text-muted dark:text-muted" />
      <VText className="flex-1 text-base">{label}</VText>
      <VSwitch
        value={isDark}
        onValueChange={() => appearanceStore.toggleScheme()}
      />
    </View>
  );
}
