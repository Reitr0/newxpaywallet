// src/app/screens/home/components/WalletSwitchSheet.js
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, TextInput, Keyboard, Alert } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import VBottomSheet from '@src/shared/ui/primitives/VBottomSheet';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';
import Fiat from '@src/shared/ui/atoms/Fiat';
import { multiWalletStore } from '@features/wallet/state/multiWalletStore';

/**
 * WalletSwitchSheet
 * Bottom sheet popup to switch between wallets, rename, or add a new one.
 *
 * Props:
 *  - wallets: Array<{ id, name, address, totalUsd }>
 *  - activeId: string  (current wallet id)
 *  - totalUsd: number
 *  - onSelect(wallet): called when user picks a wallet
 *  - onAddWallet(): called when user taps "Add a Wallet"
 */
const WalletSwitchSheet = forwardRef(
  ({ wallets = [], activeId, totalUsd = 0, onSelect, onAddWallet }, ref) => {
    const sheetRef = useRef(null);
    const [editMode, setEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    useImperativeHandle(ref, () => ({
      present: () => {
        setEditMode(false);
        setEditingId(null);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const truncate = (addr) => {
      if (!addr || addr.length < 12) return addr || '';
      return addr.slice(0, 6) + '...' + addr.slice(-4);
    };

    const startRename = (w) => {
      setEditingId(w.id);
      setEditName(w.name || '');
    };

    const saveRename = () => {
      if (editingId && editName.trim()) {
        multiWalletStore.renameWallet(editingId, editName.trim());
      }
      setEditingId(null);
      setEditName('');
      Keyboard.dismiss();
    };

    const cancelRename = () => {
      setEditingId(null);
      setEditName('');
      Keyboard.dismiss();
    };

    const confirmRemove = (w) => {
      if (wallets.length <= 1) {
        Alert.alert('Cannot remove', 'You must have at least one wallet.');
        return;
      }
      Alert.alert(
        'Remove wallet',
        `Are you sure you want to remove "${w.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              multiWalletStore.removeWallet(w.id);
            },
          },
        ],
      );
    };

    return (
      <VBottomSheet ref={sheetRef} snapPoints={['70%']} scrollable>
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[0]}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          style={{ flex: 1 }}
        >
          {/* Sticky header block */}
          <View className="bg-card pb-2">
            <View className="flex-row items-center justify-between mb-3">
              <VText className="text-title text-xl font-bold">Switch wallet</VText>
              <VPressable
                className="w-8 h-8 items-center justify-center rounded-full bg-item"
                onPress={() => setEditMode(v => !v)}
              >
                <VIcon
                  name={editMode ? 'check' : 'pencil-outline'}
                  type="MaterialCommunityIcons"
                  size={16}
                  className={editMode ? 'text-link' : 'text-muted'}
                />
              </VPressable>
            </View>

            <View className="flex-row items-center justify-between mb-2">
              <VText className="text-muted text-sm">Total assets</VText>
              <Fiat value={totalUsd} className="text-title font-semibold" />
            </View>
          </View>
            {wallets.map((w) => {
              const isActive = w.id === activeId;
              const isEditing = editingId === w.id;

              return (
                <VPressable
                  key={w.id}
                  className={[
                    'flex-row items-center p-3 rounded-xl mb-2',
                    isActive ? 'border border-link bg-link/10' : 'bg-item',
                  ].join(' ')}
                  onPress={() => {
                    if (editMode && !isEditing) {
                      startRename(w);
                    } else if (!editMode) {
                      onSelect?.(w);
                      sheetRef.current?.dismiss();
                    }
                  }}
                >
                  {/* Avatar */}
                  <View className="w-10 h-10 rounded-full bg-card items-center justify-center mr-3">
                    <VIcon name="wallet-outline" type="MaterialCommunityIcons" size={20} className="text-link" />
                  </View>

                  {/* Info */}
                  <View className="flex-1">
                    {isEditing ? (
                      <View className="flex-row items-center">
                        <TextInput
                          value={editName}
                          onChangeText={setEditName}
                          autoFocus
                          className="flex-1 text-title font-semibold text-base py-0 border-b border-link"
                          onSubmitEditing={saveRename}
                          onBlur={saveRename}
                          returnKeyType="done"
                          placeholderTextColor="#9AA4B2"
                          placeholder="Wallet name"
                        />
                        <VPressable onPress={saveRename} className="ml-2 p-1">
                          <VIcon name="check" type="MaterialCommunityIcons" size={18} className="text-link" />
                        </VPressable>
                        <VPressable onPress={cancelRename} className="ml-1 p-1">
                          <VIcon name="close" type="MaterialCommunityIcons" size={18} className="text-muted" />
                        </VPressable>
                      </View>
                    ) : (
                      <>
                        <VText className="text-title font-semibold">{w.name}</VText>
                        <View className="flex-row items-center mt-0.5">
                          <Fiat value={w.totalUsd ?? 0} className="text-muted text-xs" />
                        </View>
                        {w.address ? (
                          <VText className="text-muted text-xs mt-0.5">
                            EVM: {truncate(w.address)}
                          </VText>
                        ) : null}
                      </>
                    )}
                  </View>

                  {/* Edit / Active indicator */}
                  {editMode && !isEditing ? (
                    <View className="flex-row items-center">
                      <VPressable onPress={() => startRename(w)} className="p-1">
                        <VIcon name="pencil-outline" type="MaterialCommunityIcons" size={18} className="text-muted" />
                      </VPressable>
                      <VPressable
                        onPress={() => confirmRemove(w)}
                        className="p-1 ml-1"
                        disabled={wallets.length <= 1}
                      >
                        <VIcon
                          name="trash-can-outline"
                          type="MaterialCommunityIcons"
                          size={18}
                          className={wallets.length <= 1 ? 'text-muted opacity-40' : 'text-danger'}
                        />
                      </VPressable>
                    </View>
                  ) : !editMode && isActive ? (
                    <VIcon name="check-circle" type="MaterialCommunityIcons" size={20} className="text-link" />
                  ) : null}
                </VPressable>
              );
            })}

            {/* Scrollable Add wallet button at bottom of list */}
            <View style={{ paddingTop: 8, paddingBottom: 8 }}>
              <VPressable
                className="py-3 rounded-full bg-link items-center"
                onPress={() => {
                  onAddWallet?.();
                  sheetRef.current?.dismiss();
                }}
              >
                <VText className="text-inverse font-semibold text-base">Add a Wallet</VText>
              </VPressable>
            </View>
        </BottomSheetScrollView>
      </VBottomSheet>
    );
  }
);

export default WalletSwitchSheet;
