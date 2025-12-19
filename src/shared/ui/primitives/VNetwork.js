import React, { useMemo } from 'react';
import { View } from 'react-native';
import VImage from '@src/shared/ui/primitives/VImage';
import { networkStore } from '@features/network/state/networkStore';

/**
 * VNetwork
 * Compact inline network icon (non-absolute, Tailwind-only styling).
 *
 * Props:
 *  - chain: string (e.g. 'ethereum', 'bsc', 'solana', 'tron')
 *  - bordered: boolean (draw border around icon)
 *  - className: Tailwind/NativeWind class overrides
 */
function VNetwork({ chain, bordered = true, className = '' }) {
  const networkConfig = useMemo(() => networkStore.getConfig(chain), [chain]);
  const logo = networkConfig?.logoUrl || null;
  return (
    <View
      className={[
        'items-center justify-center rounded-full overflow-hidden',
        bordered ? 'border border-border-subtle' : '',
        'w-[18px] h-[18px] bg-overlay',
        className,
      ].join(' ')}
    >
      {logo ? (
        <VImage
          source={typeof logo === 'string' ? { uri: logo } : logo}
          className="w-full h-full rounded-full"
        />
      ) : (
        <View className="w-full h-full rounded-full bg-border-subtle" />
      )}
    </View>
  );
}

export default React.memo(VNetwork);
