// src/shared/ui/sheets/PreflightSheet.js
import React, { forwardRef, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import Fiat from '@src/shared/ui/atoms/Fiat';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';
import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VSpinner from '@src/shared/ui/primitives/VSpinner';
import { BottomSheetView } from '@gorhom/bottom-sheet';

/**
 * PreflightSheet
 * Theme-aware review sheet before sending a transaction.
 *
 * Props:
 *  - loading: boolean
 *  - confirming: boolean
 *  - pf: {
 *      canSend?: boolean,
 *      feeCrypto?: number,
 *      feeUsd?: number,
 *      feeUnit?: string,
 *      maxSendable?: number,
 *      warnings?: string[],
 *      details?: Record<string, any>,
 *      deductFromAmount?: boolean
 *    } | null
 *  - symbol: string
 *  - amount: number
 *  - to?: string
 *  - amountUsd?: number
 *  - networkName?: string
 *  - isToken?: boolean
 *  - tokenAddress?: string
 *  - onCancel?: () => void
 *  - onConfirm?: () => void
 *  - snapPoints?: string[] | number[]
 */
const PreflightSheet = forwardRef(function PreflightSheet(
  {
    loading,
    confirming = false,
    pf,
    symbol,
    amount,
    to,
    amountUsd,
    networkName,
    isToken,
    tokenAddress,
    onCancel,
    onConfirm,
    snapPoints,
  },
  ref
) {
  const feeUnit = pf?.feeUnit || symbol;
  const feeCrypto = Number(pf?.feeCrypto ?? 0);
  const sameUnit = feeUnit?.toUpperCase?.() === symbol?.toUpperCase?.();
  const deductFromAmount = !!pf?.deductFromAmount;

  // Actual tokens the recipient receives
  const actualReceive = useMemo(() => {
    if (!sameUnit || !deductFromAmount) return Number(amount || 0);
    return Math.max(0, Number(amount || 0) - feeCrypto);
  }, [amount, sameUnit, deductFromAmount, feeCrypto]);

  // Total cost summary
  const totalSpendDesc = useMemo(() => {
    const amt = Number(amount || 0);
    if (sameUnit) {
      if (deductFromAmount) {
        return { mode: 'single', primary: amt, primaryUnit: symbol };
      }
      return { mode: 'single', primary: amt + feeCrypto, primaryUnit: symbol };
    }
    return {
      mode: 'dual',
      primary: amt,
      primaryUnit: symbol,
      secondary: feeCrypto,
      secondaryUnit: feeUnit,
    };
  }, [amount, symbol, sameUnit, deductFromAmount, feeCrypto, feeUnit]);

  const canConfirm = useMemo(
    () => !loading && !confirming && (pf ? pf.canSend !== false : true),
    [loading, pf, confirming]
  );

  const short = (s) => {
    const v = String(s || '');
    if (v.length <= 12) return v;
    return `${v.slice(0, 6)}…${v.slice(-6)}`;
  };

  return (
    <VBottomSheet
      ref={ref}
      snapPoints={snapPoints || ['45%']}
      initialIndex={0}
      indicatorColor="#2C3746"
    >
      <BottomSheetView>
        <View className="flex-1 bg-app px-4">
          {/* Title */}
          <View className="items-center mb-2">
            <VText className="text-title font-semibold text-base">
              Review Transfer
            </VText>
          </View>
          {/* Context Header */}
          <View className="mt-2 mb-3">
            <View className="flex-row items-center justify-between">
              <VText className="text-muted">You're sending</VText>
              <View className="flex-row items-center">
                {!!networkName && (
                  <View className="px-2 py-1 rounded-full bg-item border border-border-subtle ml-2">
                    <VText className="text-2xs text-muted">{networkName}</VText>
                  </View>
                )}
                {!!isToken && !!tokenAddress && (
                  <View className="px-2 py-1 rounded-full bg-item border border-border-subtle ml-2">
                    <VText className="text-2xs text-muted">
                      {short(tokenAddress)}
                    </VText>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-row items-end justify-between mt-2">
              <VText className="text-title text-2xl font-extrabold">
                <CryptoAmount
                  amount={Number(amount || 0)}
                  decimals={0}
                  symbol={symbol}
                />
              </VText>
              {Number.isFinite(amountUsd) && (
                <VText className="text-muted">
                  ≈ <Fiat value={amountUsd} />
                </VText>
              )}
            </View>
          </View>

          {/* Card with breakdown */}
          <View className="bg-item rounded-2xl p-3 border border-border-subtle">
            {/* To */}
            {!!to && (
              <View className="flex-row items-center justify-between mb-3">
                <VText className="text-muted">To</VText>
                <VText
                  className="text-title font-medium ml-3"
                  numberOfLines={1}
                  style={{ maxWidth: '75%' }}
                >
                  {short(to)}
                </VText>
              </View>
            )}

            {/* Fee */}
            <View className="flex-row items-center justify-between mb-2">
              <VText className="text-muted">Estimated fee</VText>
              {loading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" />
                  <VText className="text-muted ml-2">Calculating…</VText>
                </View>
              ) : (
                <VText className="text-title">
                  <CryptoAmount
                    amount={feeCrypto}
                    decimals={0}
                    symbol={feeUnit}
                  />{' '}
                  (<Fiat value={Number(pf?.feeUsd ?? 0)} />)
                </VText>
              )}
            </View>

            {/* Divider */}
            <View className="h-[1px] bg-border-subtle my-2" />

            {/* Recipient receive */}
            <View className="flex-row items-center justify-between mb-2">
              <VText className="text-muted">Recipient will receive</VText>
              <VText className="text-title font-medium">
                <CryptoAmount
                  amount={actualReceive}
                  decimals={0}
                  symbol={symbol}
                />
              </VText>
            </View>

            {/* Total spent */}
            <View className="flex-row items-center justify-between">
              <VText className="text-muted">Total you'll spend</VText>
              {totalSpendDesc.mode === 'single' ? (
                <VText className="text-title font-medium">
                  <CryptoAmount
                    amount={totalSpendDesc.primary}
                    decimals={0}
                    symbol={totalSpendDesc.primaryUnit}
                  />
                </VText>
              ) : (
                <View className="items-end">
                  <VText className="text-title font-medium">
                    <CryptoAmount
                      amount={totalSpendDesc.primary}
                      decimals={0}
                      symbol={totalSpendDesc.primaryUnit}
                    />
                  </VText>
                  <VText className="text-title text-2xs mt-0.5">
                    +{' '}
                    <CryptoAmount
                      amount={totalSpendDesc.secondary}
                      decimals={0}
                      symbol={totalSpendDesc.secondaryUnit}
                    />
                  </VText>
                </View>
              )}
            </View>

            {/* Warnings */}
            {!!pf?.warnings?.length && (
              <View className="mt-3 p-2 rounded-xl bg-warning/10 border border-warning/30">
                <VText className="text-warning text-xs">
                  {pf.warnings.join('\n')}
                </VText>
              </View>
            )}
          </View>

          {/* Footer actions */}
          <View className="mt-4 pt-3 border-t border-border-subtle flex-row gap-3">
            {/* Cancel */}
            <VPressable
              className={`
      flex-1 py-3 rounded-2xl bg-item border border-border-subtle 
      items-center ${confirming ? 'opacity-50' : 'active:opacity-80'}
    `}
              onPress={onCancel}
              accessibilityRole="button"
              disabled={confirming}
            >
              <VText className="text-title font-medium">Cancel</VText>
            </VPressable>

            {/* Confirm */}
            <VPressable
              className={[
                'flex-1 py-3 rounded-2xl items-center justify-center',
                canConfirm ? 'bg-link active:opacity-80' : 'bg-link/40',
              ].join(' ')}
              disabled={!canConfirm || confirming}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              {confirming ? (
                <VSpinner />
              ) : (
                <VText className="text-inverse font-medium">Confirm</VText>
              )}
            </VPressable>
          </View>
        </View>
      </BottomSheetView>
    </VBottomSheet>
  );
});

export default PreflightSheet;
