// src/shared/ui/sheets/SetAmountSheet.js
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import Fiat from '@src/shared/ui/atoms/Fiat';

function isValidNumberStr(s) {
  if (s == null) return false;
  const trimmed = String(s).trim();
  if (trimmed === '' || trimmed === '.') return false;
  // allow only digits + optional single dot
  if (!/^\d*\.?\d*$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0;
}

const PRESETS = ['10', '25', '50', '100', '250', '500'];

const SetAmountSheet = forwardRef(function SetAmountSheet(
  {
    symbol = '',
    initialAmount = '',
    usdPerUnit,            // optional: if provided, shows approx USD
    snapPoints = ['42%','70%'],
    onConfirm,             // (amountStr) => void
    onCancel,              // () => void
  },
  ref
) {
  const [amount, setAmount] = useState(String(initialAmount ?? ''));
  const valid = useMemo(() => isValidNumberStr(amount), [amount]);
  const num = useMemo(() => (valid ? Number(amount) : 0), [valid, amount]);

  useEffect(() => {
    setAmount(String(initialAmount ?? ''));
  }, [initialAmount]);

  const approxUsd = useMemo(() => {
    if (!usdPerUnit || !valid) return null;
    return num * Number(usdPerUnit);
  }, [usdPerUnit, valid, num]);

  return (
    <VBottomSheet
      ref={ref}
      snapPoints={snapPoints}
      initialIndex={0}
      indicatorColor="#2C3746"
      contentClassName="bg-overlay"
    >
      {/* Body background is theme-driven */}
      <View className="flex-1 bg-app px-4 pb-6">
        {/* Header */}
        <View className="items-center mb-3">
          <VText className="text-title font-semibold text-base">Set Amount</VText>
        </View>

        {/* Input */}
        <VText className="text-muted mb-1">Amount ({symbol})</VText>
        <View className="flex-row items-center border border-border-subtle rounded-2xl px-3 py-2 bg-item">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={`0.0 ${symbol}`}
            keyboardType="decimal-pad"
            placeholderTextColor="#888"
            className="flex-1 text-title"
          />
          {!!symbol && <VText className="text-title text-sm ml-2">{symbol}</VText>}
        </View>
        {!valid && amount !== '' && (
          <VText className="text-danger text-2xs mt-1">Enter a valid number</VText>
        )}

        {/* Presets */}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {PRESETS.map((p) => (
            <VPressable
              key={p}
              onPress={() => setAmount(p)}
              className="px-3 py-2 rounded-xl bg-item border border-border-subtle active:opacity-80"
            >
              <VText className="text-title">{p}</VText>
            </VPressable>
          ))}
        </View>

        {/* Approx USD */}
        {approxUsd != null && (
          <View className="mt-3">
            <VText className="text-muted text-xs">
              ≈ <Fiat value={approxUsd} />
            </VText>
          </View>
        )}

        {/* Actions */}
        <View className="mt-5 pt-3 border-t border-border-subtle flex-row gap-3">
          <VPressable
            className="flex-1 py-3 rounded-2xl bg-item border border-border-subtle items-center active:opacity-80"
            onPress={onCancel}
            accessibilityRole="button"
          >
            <VText className="text-title font-medium">Cancel</VText>
          </VPressable>

          <VPressable
            disabled={!valid}
            onPress={() => onConfirm?.(amount)}
            accessibilityRole="button"
            className={[
              'flex-1 py-3 rounded-2xl items-center',
              valid ? 'bg-link active:opacity-80' : 'bg-link/40',
            ].join(' ')}
          >
            <VText className="text-inverse font-medium">Confirm</VText>
          </VPressable>
        </View>
      </View>
    </VBottomSheet>
  );
});

export default SetAmountSheet
