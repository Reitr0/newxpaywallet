// src/app/components/value/CryptoAmount.js
import React, { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import VText from '@src/shared/ui/primitives/VText';
import { currencyStore } from '@features/settings/currency/state/currencyStore';
import { formatCrypto } from '@features/settings/currency/util/currencyFormat';


/**
 * CryptoAmount
 * - Displays crypto amount using app settings (locale, dp rules, dust floor).
 * - Props:
 *   amount: number|string — already in human-readable units (e.g. "0.00123")
 *   symbol: string — e.g. 'ETH'
 *   fixedDp?: number — override decimals
 *   trim?: boolean — trim trailing zeros
 *   className?: string
 */
export default function CryptoAmount({ amount, symbol, fixedDp, trim = true, className }) {
  const s = useSnapshot(currencyStore);

  const text = useMemo(() => {
    const num = Number(amount || 0);
    const dustFloor = s.dustFloorDp ?? 8;

    // Handle near-zero (dust) values
    if (num !== 0 && Math.abs(num) < Math.pow(10, -dustFloor)) {
      return `< ${Math.pow(10, -dustFloor).toFixed(dustFloor)} ${symbol}`;
    }

    const formatted = formatCrypto(num, s, { fixedDp, trim });
    return `${formatted} ${symbol}`;
  }, [amount, symbol, s, fixedDp, trim]);

  return <VText className={className}>{text}</VText>;
}
