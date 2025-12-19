import React, { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import VText from '@src/shared/ui/primitives/VText';
import { currencyStore } from '@features/settings/currency/state/currencyStore';
import { formatFiat } from '@features/settings/currency/util/currencyFormat';

/**
 * <Fiat value={1234.56} compact showCode />
 *
 * Props:
 * - value: number|string
 * - compact?: boolean        // override compact display
 * - showCode?: boolean       // force "USD" code instead of symbol
 * - className?: string
 * - maxFractionDigits?: number
 * - minFractionDigits?: number
 */
export default function Fiat({
                               value,
                               compact,
                               showCode,
                               className,
                               maxFractionDigits,
                               minFractionDigits,
                             }) {
  const s = useSnapshot(currencyStore);

  // Build the settings object from the store
  const settings = {
    currency: s.currency,
    locale: s.locale,
    showCurrencyCode: s.showCurrencyCode,
    compactNumbers: s.compactNumbers,
    tinyFiatThreshold: s.tinyFiatThreshold,
    dustFloorDp: s.dustFloorDp,
    cryptoDp: s.cryptoDp,
  };

  const text = useMemo(() => {
    return formatFiat(value, settings, {
      compactNumbers: typeof compact === 'boolean' ? compact : undefined,
      showCurrencyCode: typeof showCode === 'boolean' ? showCode : undefined,
      maxFractionDigits,
      minFractionDigits,
    });
  }, [
    value,
    // settings deps
    s.currency,
    s.locale,
    s.showCurrencyCode,
    s.compactNumbers,
    s.tinyFiatThreshold,
    // overrides
    compact,
    showCode,
    maxFractionDigits,
    minFractionDigits,
  ]);

  return <VText className={className}>{text}</VText>;
}
