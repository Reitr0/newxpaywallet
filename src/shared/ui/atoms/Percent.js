// src/app/components/value/Percent.js
import React, { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import VText from '@src/shared/ui/primitives/VText';
import { currencyStore } from '@features/settings/currency/state/currencyStore';

/**
 * Percent
 * - Locale-aware percentage display with coloring and sign.
 * - Props:
 *   value: number|string  →  e.g. -1.23, 0.56
 *   dp?: number           →  decimal places (default 2)
 *   withSign?: boolean    →  show + for positives (default true)
 *   className?: string
 */
export default function Percent({ value, className, dp = 2, withSign = true }) {
  const { locale } = useSnapshot(currencyStore);

  const text = useMemo(() => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '–';

    const abs = Math.abs(num);
    const formatted = new Intl.NumberFormat(locale || undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: dp,
    }).format(abs);

    const sign = withSign ? (num > 0 ? '+' : num < 0 ? '−' : '') : '';
    return `${sign}${formatted}%`;
  }, [value, dp, locale, withSign]);

  const color =
    Number(value) > 0 ? 'text-success'
      : Number(value) < 0 ? 'text-danger'
        : 'text-muted';

  return (
    <VText className={[className, color].filter(Boolean).join(' ')}>
      {text}
    </VText>
  );
}
