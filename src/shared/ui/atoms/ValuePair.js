// src/app/components/value/ValuePair.js
import React, { useMemo } from 'react';
import CryptoAmount from '@src/shared/ui/atoms/CryptoAmount';
import Fiat from '@src/shared/ui/atoms/Fiat';

export default function ValuePair({ amount, symbol = '', price = 0 }) {
  const usd = useMemo(() => {
    return Number(amount || 0) * Number(price || 0);
  }, [amount, price]);

  return (
    <>
      <Fiat value={usd} className="text-sm text-title font-semibold" />
      <CryptoAmount amount={amount} symbol={symbol} className="text-2xs text-muted mt-1" />
    </>
  );
}
