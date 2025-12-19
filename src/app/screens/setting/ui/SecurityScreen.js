// src/features/settings/security/ui/SecurityScreen.jsx
import React, { useMemo, useRef, useCallback, useState } from 'react';
import { SectionList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';
import { useNavigation } from '@react-navigation/native';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VSwitch from '@src/shared/ui/primitives/VSwitch';
import OptionSheet from '@src/app/screens/setting/components/OptionSheet';
import { authStore } from '@src/features/auth/state/authStore';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';

/* ---------------------- Rows ---------------------- */
function Row({ label, sub, value, onPress }) {
  return (
    <VPressable onPress={onPress} className="px-4 py-3 active:opacity-70 bg-surface flex-col">
      <VText className="text-base text-foreground">{label}</VText>
      {sub ? <VText className="text-muted text-sm mt-0.5">{sub}</VText> : null}
      {value ? (
        <VText className="absolute right-4 top-3 text-muted text-sm">{value}</VText>
      ) : null}
    </VPressable>
  );
}

function ToggleRow({ label, sub, value, onValueChange }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-surface">
      <View className="flex-1 pr-4">
        <VText className="text-base text-foreground">{label}</VText>
        {sub ? <VText className="text-muted text-sm mt-0.5">{sub}</VText> : null}
      </View>
      <VSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

/* ---------------------- Screen ---------------------- */
export default function SecurityScreen() {
  const { t } = useTranslation();
  const nav = useNavigation();
  const snap = useSnapshot(authStore);

  // Refs
  const autoLockSheet = useRef(null);
  const lockMethodSheet = useRef(null);

  // Options
  const AUTO_LOCK_OPTIONS = useMemo(() => ([
    { key: 'immediate', label: t('security.immediate', 'Immediate') },
    { key: '30s',       label: t('security.after30s', 'After 30 seconds') },
    { key: '1m',        label: t('security.after1m', 'After 1 minute') },
    { key: '5m',        label: t('security.after5m', 'After 5 minutes') },
    { key: '10m',       label: t('security.after10m', 'After 10 minutes') },
  ]), [t]);

  const LOCK_METHODS = useMemo(() => ([
    { key: 'passcode',  label: t('security.passcode', 'Passcode') },
    { key: 'biometric', label: t('security.biometric', 'Biometric') },
  ]), [t]);

  // Derived labels
  const autoLockLabel =
    AUTO_LOCK_OPTIONS.find((x) => x.key === snap.autoLock)?.label ?? snap.autoLock;

  const lockMethodLabel =
    LOCK_METHODS.find((x) => x.key === snap.lockMethod)?.label ?? snap.lockMethod;

  /* ---------------------- Handlers ---------------------- */
  const handleChangePasscode = useCallback(() => {
    nav.navigate('AppLockScreen', {
      mode: 'change',
      showHeader: true,
      onCallBack: async () => {
        await authStore.initializePin();
        snackbarStore.show(
          t('security.passcodeChanged', 'Passcode changed successfully.'),
          'success'
        );
        nav.pop(3);
      },
    });
  }, [nav, t]);

  const handlePickAutoLock = useCallback((presetKey) => {
    authStore.setAutoLock(presetKey);
  }, []);

  const handlePickLockMethod = useCallback(async (method) => {
    if (method === 'biometric') authStore.enableBiometric();
    else authStore.disableBiometric();
    authStore.setLockMethod(method);
  }, []);

  const [txSigning, setTxSigning] = useState(true);

  /* ---------------------- Sections ---------------------- */
  const sections = useMemo(
    () => [
      {
        title: t('security.section.general', 'General'),
        data: [
          {
            key: 'passcodeRow',
            label: t('security.passcode', 'Passcode'),
            sub: t('security.changePasscode', 'Change your passcode'),
            value: snap.hasPin
              ? t('security.enabled', 'Enabled')
              : t('security.notSet', 'Not set'),
            onPress: handleChangePasscode,
          },
          {
            key: 'autoLock',
            label: t('security.autoLock', 'Auto-lock'),
            value: autoLockLabel,
            onPress: () => autoLockSheet.current?.present?.(),
          },
          {
            key: 'lockMethod',
            label: t('security.lockMethod', 'Lock method'),
            value: lockMethodLabel,
            onPress: () => lockMethodSheet.current?.present?.(),
          },
        ],
      },
      {
        title: t('security.section.transactions', 'Transactions'),
        data: [
          {
            key: 'txSigning',
            type: 'toggle',
            label: t('security.txSigning', 'Transaction signing'),
            sub: t('security.txSigningDesc', 'Ask for approval ahead of transactions.'),
            value: txSigning,
            onValueChange: setTxSigning,
          },
        ],
      },
    ],
    [t, snap.hasPin, autoLockLabel, lockMethodLabel, txSigning, handleChangePasscode]
  );

  /* ---------------------- Renderers ---------------------- */
  const renderItem = useCallback(
    ({ item }) =>
      item.type === 'toggle' ? (
        <ToggleRow
          label={item.label}
          sub={item.sub}
          value={item.value}
          onValueChange={item.onValueChange}
        />
      ) : (
        <Row
          label={item.label}
          sub={item.sub}
          value={item.value}
          onPress={item.onPress}
        />
      ),
    []
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }) => (
      <VText className="px-4 py-2 text-xs text-muted uppercase tracking-wider">
        {title}
      </VText>
    ),
    []
  );

  /* ---------------------- Render ---------------------- */
  return (
    <View className="flex-1 bg-app">
      <View className="w-full h-8 px-2">
        <VBack accessibilityLabel={t('common.back', 'Back')} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />

      {/* Sheets */}
      <OptionSheet
        title={t('security.pickAutoLock', 'Auto-lock')}
        items={AUTO_LOCK_OPTIONS}
        selected={snap.autoLock}
        onSelect={handlePickAutoLock}
        sheetRef={autoLockSheet}
      />
      <OptionSheet
        title={t('security.pickLockMethod', 'Lock method')}
        items={LOCK_METHODS}
        selected={snap.lockMethod}
        onSelect={handlePickLockMethod}
        sheetRef={lockMethodSheet}
      />
    </View>
  );
}
