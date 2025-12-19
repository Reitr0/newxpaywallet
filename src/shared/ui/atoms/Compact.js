// src/app/components/value/Compact.js
import React, { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import VText from '@src/shared/ui/primitives/VText';
import { currencyStore } from '@features/settings/currency/state/currencyStore';
import { formatCompactNumber } from '@features/settings/currency/util/currencyFormat';

/**
 * Compact
 * - Locale-aware compact number, e.g. 1.2K / 4.5M
 * - Respects Settings (locale, compactNumbers flag).
 *
 * Props:
 * - value: number|string
 * - digits?: number          // override max fraction digits (default 1)
 * - className?: string
 */
export default function Compact({ value, className, digits }) {
  const s = useSnapshot(currencyStore);

  const text = useMemo(() => {
    // If user disabled compact numbers in settings, show a plain localized number.
    if (s.compactNumbers === false) {
      try {
        return new Intl.NumberFormat(s.locale || undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: Math.max(0, Number.isFinite(digits) ? digits : 2),
        }).format(Number(value || 0));
      } catch {
        return String(Number(value || 0));
      }
    }

    // Compact mode
    return formatCompactNumber(value, {
      locale: s.locale,
      maximumFractionDigits: Number.isFinite(digits) ? digits : 1,
    });
  }, [value, s.compactNumbers, s.locale, digits]);

  return <VText className={className}>{text}</VText>;
}
