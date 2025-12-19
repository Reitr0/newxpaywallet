// src/pages/swap/ui/SwapScreen.js
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatUnits } from 'ethers';

import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import TokenPickerSheet from '@src/app/screens/swap/components/TokenPickerSheet';
import useSwap from '@src/app/screens/swap/hook/useSwap';
import SwapCard from '@src/app/screens/swap/components/SwapCard';
import ChainPickerSheet from '@src/app/screens/swap/components/ChainPickerSheet';
import VNetwork from '@src/shared/ui/primitives/VNetwork';

const WEI_DEC = 18;
const isNativeAddr = (addr) =>
  String(addr || '').toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export default function SwapScreen() {
  const { t } = useTranslation();
  const { state, actions } = useSwap({ slippageBps: 160 });

  const {
    chain,
    tokenList,
    fromToken,
    toToken,
    amount,
    indicative, // /price
    quote,      // /quote
    quoting,
    executing,
    fromBalance,
    toBalance,
    canSwap,    // amount > 0 && balances ok && taker present
    needApproval,
    allowanceTarget,
    error,
  } = state;

  const { setAmount, setFromToken, setToToken, submit, setChain } = actions;

  const fromRef = useRef(null);
  const toRef   = useRef(null);
  const chainSheetRef = useRef(null);

  // Prefer firm quote; otherwise indicative
  const best = quote ?? indicative;
  const isFirm = !!quote;

  // Derived amounts in human units
  const fromDec = Number(fromToken?.decimals || 18);
  const toDec   = Number(toToken?.decimals || 18);

  const sellHuman = useMemo(() => {
    const raw = best?.sellAmount ?? '0';
    try { return Number(formatUnits(raw, fromDec)); } catch { return 0; }
  }, [best, fromDec]);

  const buyHuman = useMemo(() => {
    const raw = best?.buyAmount ?? '0';
    try { return Number(formatUnits(raw, toDec)); } catch { return 0; }
  }, [best, toDec]);

  const minBuyHuman = useMemo(() => {
    const raw = best?.minBuyAmount ?? '0';
    try { return Number(formatUnits(raw, toDec)); } catch { return 0; }
  }, [best, toDec]);

  const fromFiat = useMemo(
    () => (Number(fromToken?.price) || 0) * (Number(amount) || 0),
    [fromToken, amount]
  );
  const toFiat   = useMemo(
    () => (Number(toToken?.price) || 0) * (buyHuman || 0),
    [toToken, buyHuman]
  );

  const rateText = useMemo(() => {
    const a = Number(amount || 0);
    if (!a || !buyHuman || !fromToken?.symbol || !toToken?.symbol) return null;
    const rate = buyHuman / a;
    // e.g. "1 ETH ≈ 3200 USDT"
    return t('swap.rate', '1 {{from}} ≈ {{rate}} {{to}}', {
      from: fromToken.symbol,
      to: toToken.symbol,
      rate: rate.toFixed(6),
    });
  }, [amount, buyHuman, fromToken?.symbol, toToken?.symbol, t]);

  const insufficient = useMemo(
    () => Number(amount || 0) > Number(fromBalance || 0),
    [amount, fromBalance]
  );

  // 0x fee (in BUY token units)
  const zeroExFeeBuy = useMemo(() => {
    const raw = best?.fees?.zeroExFee?.amount ?? null;
    if (!raw) return null;
    try { return Number(formatUnits(raw, toDec)); } catch { return null; }
  }, [best, toDec]);

  // Network fee (wei -> native units)
  const netFeeNative = useMemo(() => {
    const wei = best?.totalNetworkFee;
    if (!wei) return null;
    try { return Number(formatUnits(wei, WEI_DEC)); } catch { return null; }
  }, [best]);

  // Native safety: if selling native (ETH/BNB/AVAX), user must have sell + gas
  const nativeFrom = !fromToken?.address || isNativeAddr(fromToken?.address);
  const nativeUnderfunded = useMemo(() => {
    if (!nativeFrom || netFeeNative == null) return false;
    const need = Number(amount || 0) + netFeeNative;
    return need > Number(fromBalance || 0);
  }, [nativeFrom, netFeeNative, amount, fromBalance]);

  const providerName = useMemo(() => {
    const src = best?.raw?.route?.fills?.find?.(
      (f) => Number(f?.proportionBps || f?.proportion) > 0
    )?.source;
    return best?.provider || src || '0x';
  }, [best]);

  const onPressMax = () => {
    const v = Number(fromBalance || 0);
    if (v > 0) setAmount(String(v));
  };

  const onSubmit = async () => {
    // submit() runs: quote → approve? → swap
    await submit();
  };

  // CTA logic
  const ctaLabel =
    executing
      ? t('swap.submitting', 'Submitting…')
      : quoting
        ? t('swap.fetchingQuote', 'Fetching quote…')
        : insufficient
          ? t('swap.insufficient', 'Not Enough {{sym}}', { sym: fromToken?.symbol || '' }).trim()
          : nativeUnderfunded
            ? t('swap.insufficientForGas', 'Not Enough {{sym}} for gas', {
              sym: fromToken?.symbol || '',
            }).trim()
            : !isFirm
              ? t('swap.getQuote', 'Get quote')
              : needApproval
                ? t('swap.approveSymbol', 'Approve {{sym}}', { sym: fromToken?.symbol || '' }).trim()
                : canSwap
                  ? t('swap.swap', 'Swap')
                  : t('swap.enterAmount', 'Enter amount');

  const ctaDisabled =
    !canSwap || insufficient || nativeUnderfunded || quoting || executing;

  return (
    <View className="flex-1 bg-app px-4 pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        {/* --- Chain Selector --- */}
        <VPressable
          onPress={() => chainSheetRef.current?.present()}
          className="flex-row items-center bg-item px-3 py-1.5 rounded-full border border-border-subtle active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={t('swap.selectChain', 'Select Chain')}
        >
          <VNetwork chain={chain} className={'mr-2'} />
          <VText className="text-title text-sm font-medium">
            {chain?.toUpperCase?.() || t('swap.selectChain', 'Select Chain')}
          </VText>
          <VIcon
            name="chevron-down"
            type="MaterialCommunityIcons"
            size={16}
            className="text-muted ml-1"
          />
        </VPressable>

        {/* --- Slippage pill (static 1.6% here) --- */}
        <VPressable
          className="flex-row items-center bg-item px-3 py-1 rounded-full border border-border-subtle active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={t('swap.slippage', 'Slippage')}
        >
          <VIcon name="tune" type="MaterialCommunityIcons" size={14} className="text-title mr-1" />
          <VText className="text-title text-xs">{t('swap.slippageValue', '{{v}}%', { v: '1.6' })}</VText>
        </VPressable>
      </View>

      {/* From / To */}
      <View className="relative rounded-2xl bg-transparent" pointerEvents="box-none">
        {/* From */}
        <SwapCard
          title={t('swap.from', 'From')}
          token={fromToken}
          amount={amount}
          fiatValue={fromFiat}
          balance={fromBalance}
          onPressMax={onPressMax}
          onPressToken={() => fromRef.current?.present()}
          onChangeAmount={setAmount}
        />

        <View className={'h-1 w-full'}>
          {/* Floating swap button */}
          <VPressable
            onPress={() => {
              const a = fromToken;
              setFromToken(toToken);
              setToToken(a);
            }}
            className="absolute items-center justify-center w-12 h-12 rounded-full bg-item border border-border-strong active:opacity-80 z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-2"
            accessibilityRole="button"
            accessibilityLabel={t('swap.switchTokens', 'Switch tokens')}
          >
            <VIcon
              name="swap-vertical"
              type="MaterialCommunityIcons"
              size={22}
              className="text-title"
            />
          </VPressable>
        </View>

        {/* To */}
        <View className="mt-4">
          <SwapCard
            title={t('swap.to', 'To')}
            token={toToken}
            amount={buyHuman ? String(buyHuman) : best ? '~' : '0'}
            fiatValue={toFiat}
            balance={toBalance}
            editable={false}
            onPressToken={() => toRef.current?.present()}
          />
        </View>
      </View>

      {(rateText || best?.minBuyAmount) ? (
        <View className="mt-2 rounded-2xl bg-item border border-border-subtle px-4 py-2">
          <View className="flex-row items-center justify-between">
            {/* Rate */}
            {rateText ? (
              <View className="flex-row items-center flex-shrink">
                <VIcon name="sync" type="Ionicons" size={14} className="text-muted mr-2" />
                <VText className="text-title text-xs" numberOfLines={1}>
                  {rateText}
                </VText>
              </View>
            ) : <View />}

            {/* Min received */}
            {best?.minBuyAmount ? (
              <View className="flex-row items-center">
                <VText className="text-muted text-xs mr-1">
                  {t('swap.minReceived', 'Min received:')}
                </VText>
                <VText className="text-title text-xs">
                  {minBuyHuman.toFixed(6)} {toToken?.symbol || ''}
                </VText>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Allowance target (spender) */}
      {isFirm && needApproval && allowanceTarget ? (
        <View className="mt-2 rounded-2xl bg-item border border-border-subtle px-4 py-2">
          <View className="flex-row items-center justify-between">
            <VText className="text-muted text-xs">{t('swap.spender', 'Spender')}</VText>
            <VText className="text-title text-xs">{allowanceTarget}</VText>
          </View>
        </View>
      ) : null}

      {/* Network fee + Provider */}
      {netFeeNative ? (
        <View className="mt-3 rounded-2xl bg-item border border-border-subtle px-4 py-3">
          <View className="flex-row items-center justify-between mb-2">
            <VText className="text-title">{t('swap.networkFee', 'Network fee')}</VText>
            <VText className="text-title">
              {`${netFeeNative.toFixed(6)} ${fromToken?.symbol || ''}`}
            </VText>
          </View>
          <View className="flex-row items-center justify-between">
            <VText className="text-title">{t('swap.provider', 'Provider')}</VText>
            <VText className="text-title">{providerName}</VText>
          </View>
        </View>
      ) : null}

      {/* Warnings / errors */}
      {nativeUnderfunded ? (
        <VText className="text-xs text-red-500 mt-2">
          {t(
            'swap.needAmountPlusGas',
            'You need ~{{need}} {{sym}} (amount + gas).',
            {
              need: (Number(amount || 0) + (netFeeNative || 0)).toFixed(6),
              sym: fromToken?.symbol || '',
            }
          )}
        </VText>
      ) : null}

      {error ? (
        <VText className="text-xs text-red-500 mt-2">
          {String(error)}
        </VText>
      ) : null}

      {/* CTA */}
      <VPressable
        className={[
          'mt-auto mb-6 py-3 rounded-full items-center',
          !ctaDisabled ? 'bg-link active:opacity-80' : 'bg-item opacity-60',
        ].join(' ')}
        disabled={ctaDisabled}
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <VText className="text-inverse font-medium text-base">{ctaLabel}</VText>
      </VPressable>

      {/* Token pickers */}
      <TokenPickerSheet
        ref={fromRef}
        title={t('swap.selectTokenFrom', 'Select token to swap from')}
        chain={chain}
        tokens={tokenList}
        exclude={toToken ? [toToken.address || toToken.symbol, toToken.id] : []}
        onSelect={(tkn) => { setFromToken(tkn); fromRef.current?.dismiss(); }}
      />
      <TokenPickerSheet
        ref={toRef}
        title={t('swap.selectTokenTo', 'Select token to swap to')}
        chain={chain}
        tokens={tokenList}
        exclude={fromToken ? [fromToken.address || fromToken.symbol, fromToken.id] : []}
        onSelect={(tkn) => { setToToken(tkn); toRef.current?.dismiss(); }}
      />
      <ChainPickerSheet
        ref={chainSheetRef}
        onSelect={(selectedChain) => {
          setChain(selectedChain);
        }}
      />
    </View>
  );
}
