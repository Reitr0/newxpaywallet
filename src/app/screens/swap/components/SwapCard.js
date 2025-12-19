// src/features/swap/ui/SwapCard.js
import React, { useCallback } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VText from '@src/shared/ui/primitives/VText';
import Fiat from '@src/shared/ui/atoms/Fiat';
import TokenIcon from '@src/shared/ui/primitives/VTokenIcon';
import VNetworkBadge from '@src/shared/ui/primitives/VNetworkBadge';
import VIcon from '@src/shared/ui/atoms/VIcon';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';

function SwapCard({
                    title,
                    token,
                    amount,
                    fiatValue,
                    onPressToken,
                    onChangeAmount,
                    editable = true,
                    balance,
                    onPressMax,
                    disabled = false,
                    loading = false,
                  }) {
  const decimals = Number.isFinite(token?.decimals) ? token.decimals : 18;
  const tokenSymbol = token?.symbol ?? 'Select';
  const tokenChain  = token?.chain  ?? '—';
  const tokenKey    = token?.id || token?.address || token?.symbol || 'unknown';
  // Safer amount handler: allow only digits + one dot, clamp to token.decimals, trim leading zeros
  const handleChangeAmount = useCallback((text) => {
    if (!onChangeAmount) return;
    const raw = String(text ?? '').replace(',', '.').replace(/[^\d.]/g, '');
    const parts = raw.split('.');
    const intPart = (parts[0] || '').replace(/^0+(?=\d)/, '') || (parts.length > 1 ? '0' : ''); // keep leading 0 only for decimals
    const fracPart = (parts[1] || '').slice(0, Math.max(0, Math.min(18, decimals)));
    const cleaned = parts.length > 1 ? `${intPart || '0'}.${fracPart}` : intPart;
    onChangeAmount(cleaned);
  }, [onChangeAmount, decimals]);
  const canMax = editable && typeof onPressMax === 'function' && Number(balance) > 0 && !disabled;
  return (
    <View className="rounded-2xl bg-item border border-border-subtle px-4 py-3">
      {/* Top row: Title + Balance/Max */}
      <View className="flex-row items-center justify-between h-8">
        <VText className="text-muted">{title}</VText>
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center">
            <VIcon
              name="wallet-outline"
              type="MaterialCommunityIcons"
              size={14}
              className="text-muted mr-1"
            />
            {token !== null && (
              <CryptoAmount
                amount={balance}
                symbol={token?.symbol}
                className="text-muted"
              />
            )}
          </View>

          {/* Right: Percentage quick-select chips */}
          {canMax && (
            <View className="flex-row space-x-1">
              {[
                { label: '25%', value: 0.25 },
                { label: '50%', value: 0.5 },
                { label: 'MAX', value: 1 },
              ].map(({ label, value }) => (
                <VPressable
                  key={label}
                  onPress={() => {
                    if (!balance) return;
                    const v = Number(balance) * value;
                    onChangeAmount(String(v));
                  }}
                  disabled={disabled}
                  className="px-2 py-1 mx-1 rounded-full bg-border-subtle active:opacity-80"
                >
                  <VText className="text-title text-xs">{label}</VText>
                </VPressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Main row */}
      <View className="flex-row items-center justify-between">
        {/* Left: token selector */}
        <VPressable
          className={`flex-row items-center ${disabled ? 'opacity-60' : 'active:opacity-80'}`}
          onPress={onPressToken}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Select token"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {/* Icon container needs relative for absolute badge */}
          <View style={styles.iconWrap}>
            <TokenIcon tokenKey={tokenKey} className="w-10 h-10 mr-2 bg-black rounded-full" />
            {!!token?.networkLogoUrl && (
              <VNetworkBadge source={{ uri: token.networkLogoUrl }} style={styles.networkIcon} />
            )}
          </View>

          <View>
            <VText className="text-title font-semibold" numberOfLines={1}>
              {tokenSymbol}
            </VText>
            <VText className="text-muted text-xs" numberOfLines={1}>
              {tokenChain}
            </VText>
          </View>
        </VPressable>

        {/* Right: amount input */}
        <View className="items-end flex-1 ml-3 ">
          {editable ? (
            <TextInput
              value={amount}
              onChangeText={handleChangeAmount}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0"
              placeholderTextColor="#888"
              editable={!disabled}
              selectTextOnFocus
              className="text-title text-right text-2xl font-semibold"
              accessibilityLabel="Amount to swap"
            />
          ) : (
            <VText className="text-title text-2xl font-semibold">
              {amount || '0'}
            </VText>
          )}
          <Fiat className="text-muted mt-1 mr-1" value={Number.isFinite(fiatValue) ? fiatValue : 0} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    position: 'relative',
    marginRight: 8,
  },
  networkIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
});

export default React.memo(SwapCard);
