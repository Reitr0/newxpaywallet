import React, { useCallback } from 'react';
import { RowWallet } from '@src/app/screens/wallet/components/RowItem';
import useTransfi from '@src/app/screens/wallet/hooks/useTransfi';

function WalletPickRow({ item, action, navigation }) {
    const { openBuy, openSell } = useTransfi({
        asset: item,
        navigation,
        country: 'VN',
        fiatTicker: 'VND',
    });

    const onPress = useCallback(() => {
        switch (action) {
            case 'SEND':
                navigation.navigate('WalletSendScreen', { assetId: item.id });
                break;
            case 'RECEIVE':
                navigation.navigate('WalletReceiveScreen', { assetId: item.id });
                break;
            case 'SWAP':
                navigation.navigate('SwapScreen', { assetId: item.id });
                break;
            case 'BUY':
                openBuy();
                break;
            case 'SELL':
                openSell();
                break;
            default:
                break;
        }
    }, [action, item?.id, navigation, openBuy, openSell]);

    return <RowWallet item={item} onPress={onPress} />;
}

export default React.memo(WalletPickRow);
