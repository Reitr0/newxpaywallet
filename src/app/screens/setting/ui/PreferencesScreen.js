// src/features/settings/preferences/ui/PreferencesScreen.jsx
import React, { useMemo, useRef } from 'react';
import { SectionList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VSwitch from '@src/shared/ui/primitives/VSwitch';
import { currencyStore, useCurrency } from '@features/settings/currency/state/currencyStore';
import OptionSheet from '@src/app/screens/setting/components/OptionSheet';
import { localeStore } from '@features/settings/locale/state/localeStore';


/* ---------- Small Rows ---------- */
function Row({ icon, label, value, onPress }) {
  return (
    <VPressable className="flex-row items-center px-4 py-3 bg-surface active:opacity-70" onPress={onPress}>
      {icon ? <VIcon {...icon} size={20} className="mr-3 text-muted" /> : null}
      <VText className="flex-1 text-base">{label}</VText>
      {value ? <VText className="text-muted mr-2">{value}</VText> : null}
      <VIcon name="chevron-right" type="Feather" size={18} className="text-muted" />
    </VPressable>
  );
}
function ToggleRow({ icon, label, value, onValueChange }) {
  return (
    <View className="flex-row items-center px-4 py-3 bg-surface">
      {icon ? <VIcon {...icon} size={20} className="mr-3" /> : null}
      <VText className="flex-1 text-base">{label}</VText>
      <VSwitch value={value} onValueChange={onValueChange} className="scale-90" />
    </View>
  );
}

const CURRENCIES = [
  { key: 'USD', label: 'USD – US Dollar' },
  { key: 'EUR', label: 'EUR – Euro' },
  { key: 'GBP', label: 'GBP – British Pound' },
  { key: 'JPY', label: 'JPY – Japanese Yen' },
  { key: 'KRW', label: 'KRW – Korean Won' },
  { key: 'CNY', label: 'CNY – Chinese Yuan' },
  { key: 'VND', label: 'VND – Vietnamese Đồng' },
  { key: 'INR', label: 'INR – Indian Rupee' },
  { key: 'IDR', label: 'IDR – Indonesian Rupiah' },
  { key: 'TRY', label: 'TRY – Turkish Lira' },
  { key: 'RUB', label: 'RUB – Russian Ruble' },
  { key: 'BRL', label: 'BRL – Brazilian Real' },
  { key: 'AUD', label: 'AUD – Australian Dollar' },
  { key: 'CAD', label: 'CAD – Canadian Dollar' },
  { key: 'CHF', label: 'CHF – Swiss Franc' },
  { key: 'HKD', label: 'HKD – Hong Kong Dollar' },
  { key: 'SGD', label: 'SGD – Singapore Dollar' },
  { key: 'MXN', label: 'MXN – Mexican Peso' },
  { key: 'AED', label: 'AED – UAE Dirham' },
  { key: 'SAR', label: 'SAR – Saudi Riyal' },
];

const LOCALES = [
  { key: 'en-US', label: 'English (US)' },
  { key: 'en-GB', label: 'English (UK)' },
  { key: 'de-DE', label: 'Deutsch (DE)' },
  { key: 'fr-FR', label: 'Français (FR)' },
  { key: 'es-ES', label: 'Español (ES)' },
  { key: 'pt-BR', label: 'Português (BR)' },
  { key: 'tr-TR', label: 'Türkçe (TR)' },
  { key: 'vi-VN', label: 'Tiếng Việt (VN)' },
  { key: 'id-ID', label: 'Bahasa Indonesia (ID)' },
  { key: 'zh-CN', label: '简体中文 (CN)' },
  { key: 'ja-JP', label: '日本語 (JP)' },
  { key: 'ko-KR', label: '한국어 (KR)' },
];

const TINY_THRESHOLDS = [
  { key: 0, label: 'Off' },
  { key: 0.01, label: '≤ $0.01' },
  { key: 0.1, label: '≤ $0.10' },
  { key: 1, label: '≤ $1.00' },
];

const DECIMALS_0_8 = Array.from({ length: 9 }, (_, i) => ({ key: i, label: String(i) }));
const DECIMALS_2_12 = Array.from({ length: 11 }, (_, i) => {
  const n = i + 2;
  return { key: n, label: String(n) };
});

/* ---------- Screen ---------- */
export default function PreferencesScreen() {
  const { t } = useTranslation();
  const currencySnap = useCurrency();
  const localeSnap = useSnapshot(localeStore);

  const {
    currency,
    locale,
    showCurrencyCode,
    compactNumbers,
    compactFiatSecondary,
    tinyFiatThreshold,
    dustFloorDp,
    cryptoDp,
  } = currencySnap;

  // Refs for sheets
  const langSheetRef = useRef(null);
  const currencySheetRef = useRef(null);
  const localeSheetRef = useRef(null);
  const tinySheetRef = useRef(null);
  const dustDpSheetRef = useRef(null);
  const cryptoDpSheetRef = useRef(null);

  // Labels
  const langKey = (localeSnap.language || 'en').split('-')[0];
  const langLabel = useMemo(
    () => localeStore.languages.find((l) => l.key === langKey)?.label || langKey.toUpperCase(),
    [langKey]
  );
  const currencyLabel = useMemo(
    () => CURRENCIES.find((c) => c.key === currency)?.label || currency,
    [currency]
  );
  const localeLabel = useMemo(
    () => LOCALES.find((l) => l.key === (localeSnap.locale || locale))?.label || (localeSnap.locale || locale) || '',
    [localeSnap.locale, locale]
  );

  // Handlers (persist via stores)
  const onSelectLanguage = async (lng) => {
    await localeStore.setLanguage(lng); // applies i18n + RTL + persists
  };
  const onSelectCurrency = (code) => currencyStore.setCurrency(code);
  const onSelectLocale = (loc) => {
    // locale used for number/date formatting in your currency layer
    currencyStore.setLocale(loc);
    // optional: also persist as app-wide preferred locale
    localeStore.setLocale(loc);
  };
  const onSelectTiny = (v) => currencyStore.setTinyFiatThreshold(v);
  const onSelectDustDp = (n) => currencyStore.setDustFloorDp(n);
  const onSelectCryptoDp = (n) => currencyStore.setCryptoDp(n);

  // Sections
  const sections = useMemo(
    () => [
      {
        title: t('preferences.languageSection', 'Language'),
        data: [
          {
            key: 'language',
            icon: { name: 'globe', type: 'Feather' },
            label: t('preferences.language', 'Language'),
            value: langLabel,
            onPress: () => langSheetRef.current?.present?.(),
          }
        ],
      },
      {
        title: t('preferences.currencySection', 'Currency'),
        data: [
          {
            key: 'currency',
            icon: { name: 'dollar-sign', type: 'Feather' },
            label: t('preferences.currency', 'Currency'),
            value: currencyLabel,
            onPress: () => currencySheetRef.current?.present?.(),
          },
        ],
      },
    ],
    [
      t,
      langLabel,
      localeLabel,
      currencyLabel,
      showCurrencyCode,
      compactNumbers,
      compactFiatSecondary,
      tinyFiatThreshold,
      dustFloorDp,
      cryptoDp,
    ]
  );

  // Renderers
  const renderItem = ({ item }) =>
    item.type === 'toggle' ? (
      <ToggleRow
        icon={item.icon}
        label={item.label}
        value={item.value}
        onValueChange={item.onValueChange}
      />
    ) : (
      <Row icon={item.icon} label={item.label} value={item.value} onPress={item.onPress} />
    );

  const renderSectionHeader = ({ section: { title } }) => (
    <VText className="px-4 py-2 text-xs text-muted uppercase tracking-wider">{title}</VText>
  );

  return (
    <View className="flex-1 bg-app">
      <View className="w-full h-8 px-2">
        <VBack />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={64}
        contentContainerClassName="pb-20"
      />

      {/* Sheets */}
      <OptionSheet
        title={t('preferences.pickLanguage', 'Choose language')}
        items={localeStore.languages}
        selected={langKey}
        onSelect={onSelectLanguage}
        sheetRef={langSheetRef}
      />
      <OptionSheet
        title={t('preferences.pickCurrency', 'Choose currency')}
        items={CURRENCIES}
        selected={currency}
        onSelect={onSelectCurrency}
        sheetRef={currencySheetRef}
      />
      <OptionSheet
        title={t('preferences.pickLocale', 'Choose locale')}
        items={LOCALES}
        selected={localeSnap.locale || locale}
        onSelect={onSelectLocale}
        sheetRef={localeSheetRef}
      />
      <OptionSheet
        title={t('preferences.pickTiny', 'Tiny fiat threshold')}
        items={TINY_THRESHOLDS}
        selected={tinyFiatThreshold}
        onSelect={onSelectTiny}
        sheetRef={tinySheetRef}
      />
      <OptionSheet
        title={t('preferences.pickDustDp', 'Dust floor decimals')}
        items={DECIMALS_0_8}
        selected={dustFloorDp}
        onSelect={onSelectDustDp}
        sheetRef={dustDpSheetRef}
      />
      <OptionSheet
        title={t('preferences.pickCryptoDp', 'Crypto decimals')}
        items={DECIMALS_2_12}
        selected={cryptoDp?.ge1 ?? 4}
        onSelect={onSelectCryptoDp}
        sheetRef={cryptoDpSheetRef}
      />
    </View>
  );
}
