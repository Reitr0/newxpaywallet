// src/pages/home/ui/HomeScreen.js
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { RefreshControl, View, Modal, TouchableWithoutFeedback } from 'react-native';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import { walletStore } from '@features/wallet/state/walletStore';
import { multiWalletStore } from '@features/wallet/state/multiWalletStore';

import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import VFlatList from '@src/shared/ui/primitives/VFlatList';
import VItemSeparator from '@src/shared/ui/molecules/VItemSeparator';
import VListEmpty from '@src/shared/ui/molecules/VListEmpty';
import Fiat from '@src/shared/ui/atoms/Fiat';
import { RowWallet } from '@src/app/screens/wallet/components/RowItem';
import useWallet from '@src/app/screens/wallet/hooks/useWallet';
import Percent from '@src/shared/ui/atoms/Percent';
import VImage from '@src/shared/ui/primitives/VImage';
import WalletSwitchSheet from '@src/app/screens/home/components/WalletSwitchSheet';

function QuickAction({ icon, label, active, onPress }) {
  const base =
    'w-16 h-16 mx-3 rounded-2xl items-center justify-center ' +
    (active ? 'bg-link' : 'bg-item');
  const iconClass = active ? 'text-inverse' : 'text-title';
  const textClass = 'mt-2 text-center text-title';

  return (
    <VPressable
      className="items-center active:opacity-70"
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={base}>
        <VIcon
          name={icon}
          type="MaterialCommunityIcons"
          size={24}
          className={iconClass}
        />
      </View>
      <VText className={textClass}>{label}</VText>
    </VPressable>
  );
}

/* ── Category Dropdown ── */
const CATEGORIES = [
  { key: 'assets', label: 'Assets' },
  { key: 'stock', label: 'Stock' },
  { key: 'forex', label: 'Forex' },
  { key: 'rwa', label: 'RWA-T' },
];

function CategoryDropdown({ selected, onSelect, labels }) {
  const [open, setOpen] = useState(false);
  const current = CATEGORIES.find(c => c.key === selected) || CATEGORIES[0];
  const displayLabel = labels?.[`${selected}Tab`] || current.label;

  return (
    <View className="relative z-10">
      {/* Trigger */}
      <VPressable
        className="flex-row items-center bg-item px-4 py-2 rounded-xl"
        onPress={() => setOpen(!open)}
      >
        <VText className="text-title text-base font-semibold mr-2">{displayLabel}</VText>
        <VIcon
          name={open ? 'chevron-up' : 'chevron-down'}
          type="MaterialCommunityIcons"
          size={18}
          className="text-muted"
        />
      </VPressable>

      {/* Dropdown overlay */}
      {open && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View className="flex-1">
              {/* Positioned dropdown */}
              <View
                className="absolute bg-card rounded-xl border border-border-subtle mx-4 mt-48 shadow-lg"
                style={{ left: 0, right: 0, elevation: 8 }}
              >
                {CATEGORIES.map((cat) => {
                  const isActive = cat.key === selected;
                  const catLabel = labels?.[`${cat.key}Tab`] || cat.label;
                  return (
                    <VPressable
                      key={cat.key}
                      className={[
                        'px-4 py-3',
                        isActive ? 'bg-link/10' : '',
                      ].join(' ')}
                      onPress={() => {
                        onSelect(cat.key);
                        setOpen(false);
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <VText
                          className={
                            isActive
                              ? 'text-link font-semibold text-base'
                              : 'text-title text-base'
                          }
                        >
                          {catLabel}
                        </VText>
                        {isActive && (
                          <VIcon
                            name="check"
                            type="MaterialCommunityIcons"
                            size={18}
                            className="text-link"
                          />
                        )}
                      </View>
                    </VPressable>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { portfolio } = useSnapshot(walletStore);
  const [tab, setTab] = useState('assets');
  const { list: wallets, totalUsd, refresh, refreshing } = useWallet();
  const switchSheetRef = useRef(null);

  // Multi-wallet state from multiWalletStore
  const mwSnap = useSnapshot(multiWalletStore);
  const [activeWalletId, setActiveWalletId] = useState(() => {
    multiWalletStore.init();
    return multiWalletStore.activeId || 'default';
  });

  const walletsList = useMemo(() => {
    const mwWallets = mwSnap.wallets || [];
    if (mwWallets.length === 0) {
      // Fallback: show current wallet if multiWalletStore is empty
      const evmAddr = walletStore.getWalletAddressByChain?.('ethereum') || '';
      return [{ id: evmAddr.toLowerCase() || 'default', name: 'My wallet', address: evmAddr, totalUsd }];
    }
    return mwWallets.map(w => ({
      id: w.id,
      name: w.name || 'Wallet',
      address: w.evmAddress || '',
      totalUsd: w.id === mwSnap.activeId ? totalUsd : 0,
    }));
  }, [mwSnap.wallets, mwSnap.activeId, totalUsd]);

  const activeWallet = walletsList.find(w => w.id === (mwSnap.activeId || activeWalletId)) || walletsList[0];

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUp = (portfolio?.changeUsd24h ?? 0) >= 0;

  const labels = useMemo(
    () => ({
      send: t('home.actions.send', 'Send'),
      receive: t('home.actions.receive', 'Receive'),
      fund: t('home.actions.fund', 'Fund'),
      sell: t('home.actions.sell', 'Sell'),
      assetsTab: t('home.tabs.assets', 'Assets'),
      stockTab: t('home.tabs.stock', 'Stock'),
      forexTab: t('home.tabs.forex', 'Forex'),
      rwaTab: t('home.tabs.rwa', 'RWA-T'),
      manageCrypto: t('home.actions.manageCrypto', 'Manage'),
      refreshing: t('home.refreshing', 'Refreshing…'),
    }),
    [t]
  );

  const onRowPress = (item) => {
    navigation.navigate('WalletDetailScreen', { assetId: item.id });
  };

  const filteredWallets = useMemo(() => {
    const HIDDEN_CHAINS = new Set(['polygon']);
    const HIDDEN_SYMBOLS = new Set(['JYB', 'MEX']);

    const visible = wallets.filter(w =>
      !HIDDEN_CHAINS.has(w.chain) && !HIDDEN_SYMBOLS.has(w.symbol?.toUpperCase())
    );

    if (tab === 'stock') return visible.filter(w => w.type === 'stock');
    if (tab === 'forex') return visible.filter(w => w.type === 'forex');
    if (tab === 'rwa') return visible.filter(w => w.type === 'rwa');
    return visible.filter(w => !w.type || w.type === 'token');
  }, [wallets, tab]);

  const handleAddWallet = useCallback(() => {
    // Navigate to import/create wallet flow
    navigation.navigate('ImportWalletScreen');
  }, [navigation]);

  const truncateAddr = (addr) => {
    if (!addr || addr.length < 10) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  return (
    <View className="flex-1 bg-app">
      {/* Header — wallet name (tappable) */}
      <View className="flex-row items-center justify-between px-4 pt-1">
        <VPressable
          className="flex-row items-center"
          onPress={() => switchSheetRef.current?.present()}
        >
          <VImage
            source={require('@assets/images/logo.png')}
            className={'w-9 h-9 bg-item rounded-full mr-2'}
          />
          <View>
            <View className="flex-row items-center">
              <VText className="text-title font-semibold text-base">
                {activeWallet.name}
              </VText>
              {activeWallet.address ? (
                <VText className="text-muted text-xs ml-1">
                  ({truncateAddr(activeWallet.address)})
                </VText>
              ) : null}
              <VIcon
                name="chevron-down"
                type="MaterialCommunityIcons"
                size={16}
                className="text-muted ml-1"
              />
            </View>
          </View>
        </VPressable>
      </View>

      {/* Balance */}
      <View className="items-center mt-2">
        <Fiat value={totalUsd} className="text-[45px] leading-[45px] font-extrabold" />
        <VText className={isUp ? 'text-up mt-1' : 'text-down mt-1'}>
          <Fiat value={portfolio.changeUsd24h} />{' '}
          <VText className={'text-muted'}>(</VText>
          <Percent value={portfolio.changePct24h} />
          <VText className={'text-muted'}>)</VText>
        </VText>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-center px-6 mt-5">
        <QuickAction
          icon="arrow-top-right"
          label={labels.send}
          onPress={() => navigation.navigate('WalletsScreen', { action: 'SEND' })}
        />
        <QuickAction
          icon="arrow-bottom-left"
          label={labels.receive}
          onPress={() => navigation.navigate('WalletsScreen', { action: 'RECEIVE' })}
        />
      </View>

      {/* Category dropdown + manage button */}
      <View className="flex-row items-center justify-between px-4 mt-8">
        <CategoryDropdown
          selected={tab}
          onSelect={setTab}
          labels={labels}
        />
        <VPressable
          className="p-2 rounded-lg active:bg-item"
          accessibilityRole="button"
          onPress={() => navigation.navigate('ManageCrypto')}
          accessibilityLabel={labels.manageCrypto}
        >
          <VIcon
            name="tune-variant"
            type="MaterialCommunityIcons"
            size={20}
            className="text-title"
          />
        </VPressable>
      </View>

      {/* Wallet list */}
      <View className="flex-1 px-4 mt-2">
        <VFlatList
          data={filteredWallets}
          estimatedItemSize={76}
          keyExtractor={(it) => it.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#888"
              title={refreshing ? labels.refreshing : ''}
              progressViewOffset={8}
            />
          }
          renderItem={({ item }) => (
            <RowWallet
              item={item}
              onPress={onRowPress}
            />
          )}
          ItemSeparatorComponent={VItemSeparator}
          ListEmptyComponent={VListEmpty}
        />
      </View>

      {/* Wallet switch bottom sheet */}
      <WalletSwitchSheet
        ref={switchSheetRef}
        wallets={walletsList}
        activeId={mwSnap.activeId || activeWalletId}
        totalUsd={totalUsd}
        onSelect={async (w) => {
          try {
            if (w.id !== (mwSnap.activeId || activeWalletId)) {
              setActiveWalletId(w.id);
              await walletStore.switchToWallet(w.id);
              refresh();
            }
          } catch (e) {
            console.warn('Switch wallet failed:', e?.message);
          }
        }}
        onAddWallet={handleAddWallet}
      />
    </View>
  );
}
