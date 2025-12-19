// src/pages/send/ui/WalletSendScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import Fiat from '@src/shared/ui/atoms/Fiat';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';

import { walletStore } from '@features/wallet/state/walletStore';
import { platformStore } from '@features/settings/platform/state/platformStore';
import useWallet from '@src/app/screens/wallet/hooks/useWallet';
import PreflightSheet from '@src/app/screens/wallet/components/PreflightSheet';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';
import VSpinner from '@src/shared/ui/primitives/VSpinner';

export default function WalletSendScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { fee } = useSnapshot(platformStore);

  const { assetId } = route.params || {};
  const { asset, refresh: refreshAsset } = useWallet(assetId);
  const platformFee = asset ? fee?.[asset.chain] : undefined;

  // ---------------- Guard: asset not found ----------------
  useEffect(() => {
    if (!assetId) {
      snackbarStore.show('Missing asset ID.');
      navigation.goBack();
    }
  }, [assetId, navigation, t]);

  // ---------------- Form state ----------------
  const [address, setAddress] = useState('EKjXxiYPUdYwTUyhLJXkJP9qWkyQEhpe12shswVZ2cnU');
  const [amount, setAmount] = useState(''); // human units text
  const numericAmount = useMemo(() => Number(amount || 0), [amount]);

  // ---------------- Preflight (fee/limits/validation) ----------------
  const [pf, setPf] = useState(null);      // normalized preflight
  const [pfBusy, setPfBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const hasBasicInput = Boolean(address && numericAmount > 0);
  const fiatValue = (numericAmount || 0) * (asset?.price || 0);

  // Track if user tapped "Next" while preflight is running -> auto-open when ready
  const sheetRef = useRef(null);
  const pendingOpenRef = useRef(false);

  // Debounce timer + last key to avoid duplicate preflight calls
  const debounceRef = useRef(null);
  const lastPfKeyRef = useRef(null);

  const buildPfKey = useCallback(() => {
    if (!asset) return 'na';
    return JSON.stringify({
      chain: asset.chain,
      from: asset.address || null,
      to: address || null,
      amount: numericAmount || 0,
      tokenAddress: asset.isToken ? asset.tokenAddress : null,
      platformFee: platformFee ?? null,
    });
  }, [asset, address, numericAmount, platformFee]);

  const _runPreflightOnce = useCallback(async () => {
    if (!asset || !hasBasicInput) {
      setPf(null);
      return;
    }

    const key = buildPfKey();
    if (key === lastPfKeyRef.current && pf !== null) {
      // identical params and we already have a pf; skip
      return;
    }

    try {
      lastPfKeyRef.current = key;
      setPfBusy(true);

      const params = JSON.parse(key);
      const res = await walletStore.preflightSend(params);

      const next = {
        canSend: res?.canSend !== false,
        feeCrypto: Number(res?.fee ?? 0),
        feeUsd: Number(res?.feeUsd ?? 0),
        feeUnit: res?.feeUnit || asset.symbol,
        maxSendable: Number(
          res?.maxSendable ?? (asset?.balanceNum != null ? asset.balanceNum : 0)
        ),
        details: res?.details,
        deductFromAmount: !!res?.deductFromAmount,
        warnings: Array.isArray(res?.warnings) ? res.warnings : [],
      };
      setPf(next);
    } catch (e) {
      setPf(null);
      snackbarStore.show(e?.message || 'Preflight failed', 'error');
    } finally {
      setPfBusy(false);
    }
  }, [asset, hasBasicInput, buildPfKey, pf]);

  // Debounced preflight whenever inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!asset || !hasBasicInput) {
      setPf(null);
      lastPfKeyRef.current = null;
      return;
    }

    debounceRef.current = setTimeout(() => {
      _runPreflightOnce();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [asset, address, numericAmount, platformFee, hasBasicInput, _runPreflightOnce]);

  // If user requested to open while PF was busy, open when it becomes ready
  useEffect(() => {
    if (pendingOpenRef.current && !pfBusy && pf) {
      pendingOpenRef.current = false;
      sheetRef.current?.present();
    }
  }, [pfBusy, pf]);

  const onMax = () => {
    const max = Number(pf?.maxSendable ?? asset?.balanceNum ?? 0);
    setAmount(max > 0 ? String(max) : '0');
  };

  const doSend = async () => {
    if (!asset) return;
    try {
      setSending(true);
      await walletStore.sendTransaction({
        chain: asset.chain,
        from: asset.address || undefined,
        to: address,
        amount: numericAmount,
        decimals: asset.decimals ?? 18,
        tokenAddress: asset.isToken ? asset.tokenAddress : null,
        platformFee,
      });
      snackbarStore.show('Transaction sent successfully', 'success');
      walletStore.fetchBalances({ chain: asset.chain });
      refreshAsset?.();
    } catch (e) {
      snackbarStore.show(e?.message || 'Transaction failed', 'error');
    } finally {
      setSending(false);
    }
  };

  // When user taps Next:
  // - If PF is ready -> open immediately
  // - Else -> set pendingOpenRef, trigger an immediate preflight (no debounce), and open when ready
  const onSubmit = () => {
   try{
     if (!hasBasicInput) return;

     if (pf && !pfBusy) {
       sheetRef.current?.present();
       console.log(":He")
       return;
     }
     pendingOpenRef.current = true;
     if (debounceRef.current) clearTimeout(debounceRef.current);
     _runPreflightOnce();
   }catch (e) {
     console.log(e)
   }
  };

  const canSubmit =
    !!asset &&
    hasBasicInput &&
    (pf ? pf.canSend !== false : true) &&
    !sending;

  // ---------------- UI ----------------
  if (!asset) {
    return (
      <View className="flex-1 bg-app pt-8 px-4 items-center justify-center">
        <VText className="text-title">Asset not found</VText>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center px-2">
        <VBack />
        <View className="flex-1 items-center">
          <VText className="text-title font-semibold text-base">
            {t('send.title', { symbol: asset.symbol })}
          </VText>
        </View>
        <View className="w-10" />
      </View>
      <View className={'flex-1 px-4 mt-4'}>
        {/* Address */}
        <VText className="text-muted mb-1">
          {t('send.addressLabel', 'Address or Domain Name')}
        </VText>
        <View className="flex-row items-center border border-border-subtle rounded-xl px-3 py-2 mb-4">
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('send.addressPlaceholder', 'Search or Enter')}
            placeholderTextColor="#888"
            className="flex-1 text-title"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <VPressable className="ml-2" onPress={() => { /* TODO: paste */ }}>
            <VText className="text-link font-medium">{t('common.paste', 'Paste')}</VText>
          </VPressable>
          <VPressable className="ml-3" onPress={() => { /* TODO: QR scan */ }}>
            <VIcon name="qrcode-scan" type="MaterialCommunityIcons" size={18} className="text-link" />
          </VPressable>
        </View>

        {/* Amount */}
        <VText className="text-muted mb-1">
          {t('send.amountLabel', 'Amount')}
        </VText>
        <View className="flex-row items-center border border-border-subtle rounded-xl px-3 py-2">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={t('send.amountPlaceholder', { symbol: asset.symbol })}
            keyboardType="decimal-pad"
            placeholderTextColor="#888"
            className="flex-1 text-title"
          />
          <VText className="text-title text-sm mr-2">{asset.symbol}</VText>
          <VPressable onPress={onMax}>
            <VText className="text-link font-medium">{t('common.max', 'Max')}</VText>
          </VPressable>
        </View>

        {/* Hints */}
        <View className="mt-2">
          <VText className="text-muted">
            {t('send.balancePrefix', 'Balance:')}{' '}
            <CryptoAmount amount={asset.balanceNum || 0} decimals={0} symbol={asset.symbol} />
          </VText>
          <VText className="text-muted mt-1">
            ≈ <Fiat value={fiatValue} />
          </VText>

          {/* Inline preflight status */}
          {pfBusy ? (
            <View className="flex-row items-center mt-2">
              <VSpinner/>
              <VText className="text-muted ml-2">
                {t('send.calculatingFees', 'Calculating fee…')}
              </VText>
            </View>
          ) : pf ? (
            <View className="mt-2">
              <VText className="text-muted">
                {t('send.estimatedFee', 'Estimated fee:')}{' '}
                <CryptoAmount
                  amount={pf.feeCrypto}
                  decimals={0}
                  symbol={pf.feeUnit || asset.symbol}
                />
              </VText>
              {!!pf.warnings?.length && (
                <VText className="text-2xs text-warning mt-1">
                  {pf.warnings.join('  ')}
                </VText>
              )}
            </View>
          ) : null}
        </View>

        {/* Submit */}
        <VPressable
          disabled={!canSubmit}
          onPress={onSubmit}
          className={[
            'mt-auto mb-6 py-3 rounded-full items-center',
            canSubmit ? 'bg-link' : 'bg-link/40',
          ].join(' ')}
        >
          <VText className="text-inverse font-medium text-base">
            {sending ? t('send.sending', 'Sending…') : t('common.next', 'Next')}
          </VText>
        </VPressable>
      </View>

      {/* Review Sheet */}
      <PreflightSheet
        ref={sheetRef}
        loading={pfBusy}
        confirming={sending}
        pf={pf}
        symbol={asset.symbol}
        amount={numericAmount}
        to={address}
        amountUsd={fiatValue}
        networkName={asset.chain}
        isToken={asset.isToken}
        tokenAddress={asset.tokenAddress}
        onCancel={() => {
          sheetRef.current?.dismiss();
          pendingOpenRef.current = false;
        }}
        onConfirm={async () => {
          // Keep sheet OPEN to show “Sending…” state; it will dismiss after doSend
          await doSend();
          sheetRef.current?.dismiss();
        }}
      />
    </View>
  );
}
