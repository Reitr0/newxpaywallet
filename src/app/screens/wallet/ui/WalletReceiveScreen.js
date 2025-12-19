// src/pages/receive/ui/WalletReceiveScreen.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';

import useWallet from '@src/app/screens/wallet/hooks/useWallet';
import TokenIcon from '@src/shared/ui/primitives/VTokenIcon';
import SetAmountSheet from '@src/app/screens/wallet/components/SetAmountSheet';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';
import Fiat from '@src/shared/ui/atoms/Fiat';

function Badge({ children }) {
  return (
    <View className="px-2 rounded-full bg-item border border-border-subtle ml-2">
      <VText className="text-2xs text-muted">{children}</VText>
    </View>
  );
}

function Action({ icon, label, onPress }) {
  return (
    <VPressable
      className="flex-1 items-center active:opacity-80"
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className="w-12 h-12 rounded-2xl items-center justify-center bg-item">
        <VIcon name={icon} type="MaterialCommunityIcons" size={22} className="text-title" />
      </View>
      <VText className="text-title mt-2">{label}</VText>
    </VPressable>
  );
}

export default function WalletReceiveScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { assetId } = route.params || {};
  const { asset } = useWallet(assetId); // { chain, chainId?, symbol, address, isToken, tokenAddress?, decimals?, price? }

  const setAmountRef = useRef(null);
  const [amount, setAmount] = useState('');

  const isEvmChain = useMemo(() => {
    const c = String(asset?.chain || '').toLowerCase();
    return ['ethereum', 'eth', 'bsc', 'binance', 'polygon', 'matic', 'arbitrum', 'avalanche', 'optimism', 'base', 'fantom', 'linea', 'scroll', 'zksync', 'op'].includes(c);
  }, [asset?.chain]);

  const evmDecimals = Number(
    asset?.decimals != null
      ? asset.decimals
      : (asset?.isToken ? 18 : 18) // safe default if unknown
  );

  // Convert a human number string to wei (as decimal string) with given decimals.
  const toBaseUnits = useCallback((valStr, decimals) => {
    const s = String(valStr || '').trim();
    if (!s) return null;
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const [intPart, frac = ''] = s.split('.');
    const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    try {
      return BigInt(intPart + fracPadded).toString(10);
    } catch {
      return null;
    }
  }, []);

  // ---- Derive QR payload ---------------------------------------------------
  const qrValue = useMemo(() => {
    if (!asset?.address) return '';

    // No amount: simplest & most compatible (plain address)
    if (!amount) return asset.address;

    // With amount: try EVM EIP-681
    if (!isEvmChain) return asset.address;

    const wei = toBaseUnits(amount, evmDecimals);
    if (!wei) return asset.address;

    const chainIdParam = asset?.chainId != null ? `&chain_id=${Number(asset.chainId)}` : '';

    if (asset?.isToken && asset?.tokenAddress) {
      // ERC-20 transfer payload
      // ethereum:<tokenContract>/transfer?address=<receiver>&uint256=<amountWei>[&chain_id=<id>]
      return `ethereum:${asset.tokenAddress}/transfer?address=${asset.address}&uint256=${wei}${chainIdParam}`;
    }

    // Native asset payload
    // ethereum:<receiver>?value=<wei>[&chain_id=<id>]
    return `ethereum:${asset.address}?value=${wei}${chainIdParam}`;
  }, [asset?.address, asset?.isToken, asset?.tokenAddress, asset?.chainId, amount, isEvmChain, evmDecimals, toBaseUnits]);

  // ---- Actions -------------------------------------------------------------
  const doCopy = useCallback(() => {
    if (!asset?.address) return;
    Clipboard.setString(asset.address);
    snackbarStore.show(t('receive.copied', 'Address copied'), 'success');
  }, [asset?.address, t]);

  const doShare = useCallback(async () => {
    if (!asset?.address) return;
    try {
      await Share.share({ message: asset.address });
    } catch (e) {
      snackbarStore.show(e?.message || String(e), 'error');
    }
  }, [asset?.address]);

  const doSetAmount = useCallback(() => {
    setAmountRef.current?.present();
  }, []);

  // ---- UI Guards -----------------------------------------------------------
  if (!asset) {
    return (
      <View className="flex-1 items-center justify-center bg-app">
        <VText className="text-title">{t('receive.assetNotFound', 'Asset not found')}</VText>
      </View>
    );
  }

  const networkNamePretty = useMemo(() => {
    const chain = String(asset?.chain || '').toLowerCase();

    switch (chain) {
      case 'bsc':
      case 'binance':
        return t('networks.bsc', 'BNB Smart Chain');
      case 'ethereum':
      case 'eth':
        return t('networks.ethereum', 'Ethereum');
      case 'polygon':
      case 'matic':
        return t('networks.polygon', 'Polygon');
      default:
        return asset?.chain || t('networks.thisNetwork', 'This Network');
    }
  }, [asset?.chain, t]);

  const isToken = !!asset?.isToken;
  const badgeText = isToken ? t('receive.tokenBadge', 'TOKEN') : t('receive.coinBadge', 'COIN');

  return (
    <View className="flex-1 bg-app">
      {/* Header */}
      <View className="flex-row items-center px-2">
        <VBack />
        <View className="flex-1 items-center">
          <VText className="text-title font-semibold text-base">
            {t('receive.title', 'Receive')}
          </VText>
        </View>
        <View className="w-10" />
      </View>

      {/* Warning banner */}
      <View className="mx-4 mt-1 p-3 rounded-xl bg-warning border border-warning flex-row items-start">
        <VIcon
          name="information-outline"
          type="MaterialCommunityIcons"
          size={18}
          className="mt-0.5 mr-2"
        />
        <View className="flex-1">
          <VText className="text-title font-medium">
            {t(
              'receive.onlySendToThisNetwork',
              'Only send {{network}} ({{symbol}}) assets to this address.',
              { network: networkNamePretty, symbol: (asset.symbol || '').toUpperCase() }
            )}
          </VText>
          <VText className="text-muted mt-1">
            {t('receive.otherAssetsLost', 'Other assets will be lost forever.')}
          </VText>
        </View>
      </View>

      {/* Asset row */}
      <View className="items-center my-4">
        <View className="flex-row items-center mt-6">
          <TokenIcon tokenKey={asset?.id} className="w-6 h-6 mr-2" />
          <VText className="text-lg font-semibold">{(asset.symbol || '').toUpperCase()}</VText>
          <Badge>{badgeText}</Badge>
        </View>
      </View>

      {/* QR */}
      <View className="items-center">
        <View className="p-4 rounded-lg bg-item border border-border-subtle">
          <QRCode value={qrValue || asset.address} size={220} />
        </View>
        {/* Address */}
        <VText className="text-title text-center mt-3 px-6" numberOfLines={2}>
          {asset.address}
        </VText>
      </View>

      {/* Requested amount (when set) */}
      {!!amount && (
        <View className="items-center mt-2">
          <View className="flex-row items-center px-3 py-1.5 rounded-full bg-item border border-border-subtle">
            <VText className="text-title font-semibold mr-2">
              {amount} {asset.symbol}
            </VText>
            {!!asset?.price && (
              <VText className="text-muted mr-2">
                ≈ <Fiat value={Number(amount) * Number(asset.price || 0)} />
              </VText>
            )}
            <VPressable
              accessibilityLabel={t('receive.clearAmount', 'Clear amount')}
              className="ml-1 active:opacity-80"
              onPress={() => setAmount('')}
            >
              <VIcon name="close" type="MaterialCommunityIcons" size={16} className="text-muted" />
            </VPressable>
          </View>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row gap-4 px-6 mt-6">
        <Action icon="content-copy" label={t('common.copy', 'Copy')} onPress={doCopy} />
        <Action icon="cash" label={t('receive.setAmount', 'Set Amount')} onPress={doSetAmount} />
        <Action icon="share-variant" label={t('common.share', 'Share')} onPress={doShare} />
      </View>

      <SetAmountSheet
        ref={setAmountRef}
        symbol={asset.symbol}
        initialAmount={amount}
        usdPerUnit={asset?.price}
        onCancel={() => setAmountRef.current?.dismiss()}
        onConfirm={(amtStr) => {
          setAmount(amtStr);
          setAmountRef.current?.dismiss();
        }}
      />
    </View>
  );
}
