// src/features/setting/ui/SettingsScreen.js
import React, { useMemo } from 'react';
import { Linking, SectionList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import VPressable from '@src/shared/ui/primitives/VPressable';
import VText from '@src/shared/ui/primitives/VText';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VSwitch from '@src/shared/ui/primitives/VSwitch';
import ToggleTheme from '@src/app/screens/setting/components/ToggleTheme';

/* -------------------------- Row components -------------------------- */

function Row({ icon, label, onPress, right }) {
  return (
    <VPressable
      className="flex-row items-center px-4 py-3 bg-surface active:opacity-70"
      onPress={onPress}
    >
      {icon ? (
        <VIcon {...icon} size={20} className="mr-3 text-muted dark:text-muted" />
      ) : null}
      <VText className="flex-1 text-base">{label}</VText>
      {right ?? (
        <VIcon name="chevron-right" type="Feather" size={18} className="text-muted" />
      )}
    </VPressable>
  );
}

function ToggleRow({ icon, label, value, onValueChange }) {
  return (
    <View className="flex-row items-center px-4 py-3 bg-surface">
      {icon ? (
        <VIcon {...icon} size={20} className="mr-3 text-muted dark:text-muted" />
      ) : null}

      <VText className="flex-1 text-base">{label}</VText>

      <VSwitch
        value={value}
        onValueChange={onValueChange}
        className="scale-90"
      />
    </View>
  );
}

/* -------------------------- Main Screen -------------------------- */

export default function SettingsScreen() {
  const nav = useNavigation();
  const { t } = useTranslation();

  /* -------------------------- Sections Data -------------------------- */
  const sections = useMemo(
    () => [
      {
        // Was "Account" — this section holds backup/export, so use Security title for clarity
        title: t('securitySettings.title'),
        data: [
          {
            key: 'exportSecretPhrase',
            label: t('securitySettings.exportSecretPhrase'),
            icon: { name: 'key-outline', type: 'MaterialCommunityIcons' },
            onPress: () => {
              nav.navigate('AppLockScreen', {
                mode: 'enter',
                showHeader: true,
                onCallBack: () => {
                  nav.navigate('ExportMnemonicScreen');
                },
              });
            },
          },
        ],
      },
      {
        title: t('settingsScreen.general'),
        data: [
          { type: 'component', key: 'toggleTheme' }, // ToggleTheme has its own internal labels
        ],
      },
      {
        title: t('settingsScreen.preferences'),
        data: [
          {
            key: 'preferences',
            label: t('settingsScreen.preferences'),
            icon: { name: 'sliders', type: 'Feather' },
            onPress: () => nav.navigate('PreferencesScreen'),
          },
          {
            key: 'security',
            label: t('settingsScreen.security'),
            icon: { name: 'lock', type: 'Feather' },
            onPress: () => nav.navigate('SecurityScreen'),
          },
        ],
      },
      {
        title: t('settingsScreen.helpSupport'),
        data: [
          {
            key: 'helpCenter',
            label: t('supportScreen.helpCenter'),
            icon: { name: 'help-circle', type: 'Feather' },
            onPress: async () => {
              const url = 'https://codecanyon.net/user/godcrypto/portfolio';
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) await Linking.openURL(url);
            },
          },
          {
            key: 'contactSupport',
            label: t('supportScreen.contactUs'),
            icon: { name: 'headphones', type: 'Feather' },
            onPress: async () => {
              const url = 'https://codecanyon.net/user/godcrypto/portfolio';
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) await Linking.openURL(url);
            },
          },
        ],
      },
    ],
    [nav, t]
  );

  /* -------------------------- Renderers -------------------------- */

  const renderItem = ({ item }) => {
    if (item.type === 'component' && item.key === 'toggleTheme') {
      return <ToggleTheme />;
    }
    if (item.type === 'toggle') {
      return (
        <ToggleRow
          icon={item.icon}
          label={item.label}
          value={item.value}
          onValueChange={item.onValueChange}
          disabled={item.disabled}
        />
      );
    }
    return (
      <Row
        icon={item.icon}
        label={item.label}
        subtitle={item.subtitle}
        onPress={item.onPress}
      />
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <VText className="px-4 py-2 text-xs text-muted uppercase tracking-wider">
      {title}
    </VText>
  );

  return (
    <View className="flex-1 bg-app">
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.key || item.label}-${index}`}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={72}
      />
    </View>
  );
}
