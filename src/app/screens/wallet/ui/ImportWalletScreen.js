// src/app/screens/wallet/ui/ImportWalletScreen.js
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { validateMnemonic, generateMnemonic } from '@scure/bip39';
import { wordlist as en } from '@scure/bip39/wordlists/english';
import Clipboard from '@react-native-clipboard/clipboard';

import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VButton from '@src/shared/ui/primitives/VButton';
import VIcon from '@src/shared/ui/atoms/VIcon';
import { walletStore } from '@features/wallet/state/walletStore';
import { multiWalletStore } from '@features/wallet/state/multiWalletStore';
import { walletKeyringService } from '@features/wallet/service/walletKeyringService';
import { snackbarStore } from '@src/shared/ui/store/snackbarStore';

const normalizePhrase = (s = '') =>
  s.toLowerCase().replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

const VALID_COUNTS = new Set([12, 15, 18, 21, 24]);

/** Ensure the currently active wallet is saved in multiWalletStore before adding a new one */
async function _ensureCurrentWalletSaved() {
  multiWalletStore.init();

  // If multiWalletStore already has wallets, the current one is already saved
  if (multiWalletStore.wallets.length > 0) return;

  // Save the current wallet (first-time: original wallet not yet in multiWalletStore)
  // Try to get mnemonic from walletStore, or from keyring service
  const currentMnemonic = walletStore.mnemonic;
  if (!currentMnemonic) {
    console.warn('[ImportWallet] Cannot save current wallet: no mnemonic available');
    return;
  }

  const evmAddr = walletStore.getWalletAddressByChain?.('ethereum') || '';
  const solAddr = walletStore.getWalletAddressByChain?.('solana') || '';
  const btcAddr = walletStore.getWalletAddressByChain?.('bitcoin') || '';
  const walletId = evmAddr.toLowerCase() || 'default';

  multiWalletStore.addWallet({
    id: walletId,
    name: 'My wallet',
    mnemonic: currentMnemonic,
    evmAddress: evmAddr,
    solAddress: solAddr,
    btcAddress: btcAddr,
  });
  multiWalletStore.setActive(walletId);
  console.log('[ImportWallet] Saved current wallet to multiWalletStore:', walletId);
}

export default function ImportWalletScreen({ navigation }) {
  const [mode, setMode] = useState(null); // null | 'import' | 'create'
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Create mode state ──
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [hidden, setHidden] = useState(true);
  const [ack, setAck] = useState(false);

  const generatedWords = useMemo(
    () => (generatedMnemonic ? generatedMnemonic.trim().split(/\s+/) : []),
    [generatedMnemonic]
  );

  // Generate mnemonic when entering create mode
  useEffect(() => {
    if (mode === 'create' && !generatedMnemonic) {
      try {
        const m = generateMnemonic(en, 128); // 12 words
        setGeneratedMnemonic(m);
      } catch (e) {
        console.error('Failed to generate mnemonic:', e);
      }
    }
  }, [mode, generatedMnemonic]);

  // ── Import mode helpers ──
  const phrase = normalizePhrase(input);
  const words = phrase ? phrase.split(' ') : [];
  const wordCount = words.length;
  const isCountOk = VALID_COUNTS.has(wordCount);
  const isValid = isCountOk && validateMnemonic(phrase, en);

  const borderClass =
    !touched ? 'border-border-subtle' : isValid ? 'border-success' : 'border-error';

  const onPaste = useCallback(async () => {
    try {
      const txt = await Clipboard.getString();
      if (txt) {
        setInput(normalizePhrase(txt));
        setTouched(true);
      }
    } catch (e) {
      snackbarStore.show(e.message || String(e), 'error');
    }
  }, []);

  const onImport = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      // 1. Ensure current wallet is saved in multiWalletStore first
      await _ensureCurrentWalletSaved();

      // 2. Derive addresses from the new mnemonic WITHOUT replacing current wallet
      const { mnemonic: normalizedMnemonic, out: derived } =
        await walletKeyringService.deriveFromMnemonic(phrase);

      const evmAddr = derived?.ethereum?.address || '';
      const solAddr = derived?.solana?.address || '';
      const btcAddr = derived?.bitcoin?.address || '';
      const walletId = evmAddr.toLowerCase() || `wallet-${Date.now()}`;

      // 3. Check if wallet already exists
      const existing = multiWalletStore.getById(walletId);
      if (existing) {
        snackbarStore.show('This wallet is already added', 'error');
        setSubmitting(false);
        return;
      }

      // 4. Register new wallet in multiWalletStore
      const walletName = name.trim() || `Wallet ${(multiWalletStore.wallets?.length || 0) + 1}`;
      multiWalletStore.addWallet({
        id: walletId,
        name: walletName,
        mnemonic: normalizedMnemonic,
        evmAddress: evmAddr,
        solAddress: solAddr,
        btcAddress: btcAddr,
      });

      // 5. Switch to the new wallet
      await walletStore.switchToWallet(walletId);

      snackbarStore.show(`"${walletName}" imported successfully!`, 'success');
      navigation.reset({ index: 0, routes: [{ name: 'BottomTabs' }] });
    } catch (e) {
      console.error('[ImportWallet] Import failed:', e);
      snackbarStore.show(e.message || 'Import failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, phrase, name, navigation]);

  // ── Create mode helpers ──
  const onCopyMnemonic = useCallback(async () => {
    try {
      Clipboard.setString(generatedMnemonic);
      snackbarStore.show('Recovery phrase copied!', 'success');
    } catch (_) {}
  }, [generatedMnemonic]);

  const onCreateWallet = useCallback(async () => {
    if (!ack || submitting || !generatedMnemonic) return;
    setSubmitting(true);
    try {
      // 1. Ensure current wallet is saved in multiWalletStore first
      await _ensureCurrentWalletSaved();

      // 2. Derive addresses from the new mnemonic WITHOUT replacing current wallet
      const { mnemonic: normalizedMnemonic, out: derived } =
        await walletKeyringService.deriveFromMnemonic(generatedMnemonic);

      const evmAddr = derived?.ethereum?.address || '';
      const solAddr = derived?.solana?.address || '';
      const btcAddr = derived?.bitcoin?.address || '';
      const walletId = evmAddr.toLowerCase() || `wallet-${Date.now()}`;

      // 3. Register new wallet in multiWalletStore
      const walletName = name.trim() || `Wallet ${(multiWalletStore.wallets?.length || 0) + 1}`;
      multiWalletStore.addWallet({
        id: walletId,
        name: walletName,
        mnemonic: normalizedMnemonic,
        evmAddress: evmAddr,
        solAddress: solAddr,
        btcAddress: btcAddr,
      });

      // 4. Switch to the new wallet
      await walletStore.switchToWallet(walletId);

      snackbarStore.show(`"${walletName}" created successfully!`, 'success');
      navigation.reset({ index: 0, routes: [{ name: 'BottomTabs' }] });
    } catch (e) {
      console.error('[ImportWallet] Create failed:', e);
      snackbarStore.show(e.message || 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [ack, submitting, generatedMnemonic, name, navigation]);

  const resetToMenu = () => {
    setMode(null);
    setInput('');
    setName('');
    setTouched(false);
    setGeneratedMnemonic('');
    setHidden(true);
    setAck(false);
  };

  // ════════════════════════════════════════
  // ── Choose mode screen ──
  // ════════════════════════════════════════
  if (!mode) {
    return (
      <View className="flex-1 bg-app">
        <View className="flex-row items-center px-3 py-2">
          <View className="w-12">
            <VBack />
          </View>
          <VText className="flex-1 text-title text-lg font-semibold text-center mr-12">
            Add Wallet
          </VText>
        </View>

        <View className="px-5 mt-8">
          {/* Option: Create New */}
          <VPressable
            className="flex-row items-center p-4 rounded-2xl bg-item mb-4"
            onPress={() => setMode('create')}
          >
            <View className="w-12 h-12 rounded-full bg-success/15 items-center justify-center mr-4">
              <VIcon name="plus-circle-outline" type="MaterialCommunityIcons" size={24} className="text-success" />
            </View>
            <View className="flex-1">
              <VText className="text-title font-semibold text-base">Create New Wallet</VText>
              <VText className="text-muted text-sm mt-0.5">
                Generate a new recovery phrase and wallet
              </VText>
            </View>
            <VIcon name="chevron-right" type="MaterialCommunityIcons" size={22} className="text-muted" />
          </VPressable>

          {/* Option: Import */}
          <VPressable
            className="flex-row items-center p-4 rounded-2xl bg-item mb-4"
            onPress={() => setMode('import')}
          >
            <View className="w-12 h-12 rounded-full bg-link/15 items-center justify-center mr-4">
              <VIcon name="download-outline" type="MaterialCommunityIcons" size={24} className="text-link" />
            </View>
            <View className="flex-1">
              <VText className="text-title font-semibold text-base">Import Wallet</VText>
              <VText className="text-muted text-sm mt-0.5">
                Import with a secret recovery phrase (12-24 words)
              </VText>
            </View>
            <VIcon name="chevron-right" type="MaterialCommunityIcons" size={22} className="text-muted" />
          </VPressable>

          {/* Info */}
          <View className="mt-6 px-2">
            <View className="flex-row items-start mb-3">
              <VIcon name="shield-check-outline" type="MaterialCommunityIcons" size={18} className="text-muted mr-2 mt-0.5" />
              <VText className="text-muted text-sm flex-1">
                Your secret phrase is stored locally on your device and never shared
              </VText>
            </View>
            <View className="flex-row items-start">
              <VIcon name="lock-outline" type="MaterialCommunityIcons" size={18} className="text-muted mr-2 mt-0.5" />
              <VText className="text-muted text-sm flex-1">
                Each wallet is fully encrypted and secured with your PIN
              </VText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════
  // ── Create New Wallet mode ──
  // ════════════════════════════════════════
  if (mode === 'create') {
    return (
      <View className="flex-1 bg-app">
        <View className="flex-row items-center px-3 py-2">
          <VPressable onPress={resetToMenu} className="w-12 h-10 justify-center">
            <VIcon name="arrow-left" type="MaterialCommunityIcons" size={24} className="text-title" />
          </VPressable>
          <VText className="flex-1 text-title text-lg font-semibold text-center mr-12">
            Create New Wallet
          </VText>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Title & description */}
          <VText className="text-title text-xl font-semibold text-center mb-2 mt-2">
            Your Secret Recovery Phrase
          </VText>
          <VText className="text-center text-muted mb-6">
            Write these words down in order. Keep them safe and never share them with anyone.
          </VText>

          {/* Visibility + Copy controls */}
          <View className="flex-row items-center justify-center mb-4" style={{ gap: 12 }}>
            <VPressable
              onPress={() => setHidden(v => !v)}
              className="px-3 py-2 rounded-full bg-item border border-border-subtle"
            >
              <View className="flex-row items-center">
                <VIcon
                  type="MaterialCommunityIcons"
                  name={hidden ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  className="text-title mr-2"
                />
                <VText className="text-title">{hidden ? 'Reveal' : 'Hide'}</VText>
              </View>
            </VPressable>

            <VPressable
              onPress={onCopyMnemonic}
              className="px-3 py-2 rounded-full bg-item border border-border-subtle"
            >
              <View className="flex-row items-center">
                <VIcon
                  type="MaterialCommunityIcons"
                  name="content-copy"
                  size={18}
                  className="text-title mr-2"
                />
                <VText className="text-title">Copy</VText>
              </View>
            </VPressable>
          </View>

          {/* Words grid */}
          <View className="rounded-2xl p-4 bg-elevated border border-border-subtle">
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
              {generatedWords.map((w, i) => (
                <View key={`${i}-${w}`} style={{ width: '50%', paddingHorizontal: 4, paddingVertical: 4 }}>
                  <View className="flex-row items-center px-3 py-4 rounded-lg bg-item">
                    <VText className="w-8 text-muted">{String(i + 1).padStart(2, '0')}</VText>
                    <VText className="ml-2 font-semibold text-title">
                      {hidden ? '••••••' : w}
                    </VText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Acknowledgement checkbox */}
          <VPressable
            onPress={() => setAck(v => !v)}
            className="mt-6 flex-row items-start"
            style={{ gap: 12 }}
          >
            <View
              className={[
                'w-5 h-5 rounded border items-center justify-center mt-0.5',
                ack ? 'bg-link border-link' : 'bg-app border-border-subtle',
              ].join(' ')}
            >
              {ack ? (
                <VIcon type="MaterialCommunityIcons" name="check" size={16} className="text-inverse" />
              ) : null}
            </View>
            <VText className="flex-1 text-body">
              I wrote down the 12 words in order and will store them securely offline.
            </VText>
          </VPressable>

          {/* Create button */}
          <View className="mt-8">
            <VButton
              variant="primary"
              title={submitting ? 'Creating...' : 'Create Wallet'}
              onPress={onCreateWallet}
              disabled={!ack || submitting}
              className={!ack || submitting ? 'opacity-50' : ''}
            />
          </View>

          {submitting && (
            <View className="mt-4 items-center">
              <ActivityIndicator size="small" color="#888" />
              <VText className="text-muted text-sm mt-2">Setting up your new wallet...</VText>
            </View>
          )}

          {/* Safety note */}
          <VText className="mt-4 text-center text-muted text-xs px-3">
            Never share your recovery phrase. Anyone with these words can access your funds.
          </VText>
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════
  // ── Import mode ──
  // ════════════════════════════════════════
  return (
    <View className="flex-1 bg-app">
      <View className="flex-row items-center px-3 py-2">
        <VPressable onPress={resetToMenu} className="w-12 h-10 justify-center">
          <VIcon name="arrow-left" type="MaterialCommunityIcons" size={24} className="text-title" />
        </VPressable>
        <VText className="flex-1 text-title text-lg font-semibold text-center mr-12">
          Import Wallet
        </VText>
      </View>

      <View className="px-4 mt-2">
        {/* Wallet name */}
        <VText className="text-muted mb-2">Wallet name</VText>
        <View className="mb-4 rounded-2xl border border-border-subtle bg-surface px-3 py-3 flex-row items-center">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My Wallet 2"
            placeholderTextColor="#9AA4B2"
            className="flex-1 text-base text-foreground"
          />
          {!!name && (
            <VPressable onPress={() => setName('')} className="pl-2">
              <VIcon type="Feather" name="x-circle" size={18} className="text-muted" />
            </VPressable>
          )}
        </View>

        {/* Secret phrase input */}
        <VText className="text-muted mb-2">Secret recovery phrase</VText>
        <View className={`rounded-2xl border ${borderClass} bg-app mb-2`}>
          <View className="px-3 pt-2 pb-1">
            <TextInput
              value={input}
              onChangeText={(v) => {
                setInput(v);
                if (!touched) setTouched(true);
              }}
              multiline
              numberOfLines={5}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your 12–24 word recovery phrase"
              placeholderTextColor="#9AA4B2"
              className="text-base text-foreground min-h-[120px]"
            />
            <View className="flex-row justify-end">
              <VPressable onPress={onPaste} className="py-2 px-1">
                <VText className="text-link">Paste</VText>
              </VPressable>
            </View>
          </View>
        </View>

        {/* Hint */}
        <VText className="text-center text-muted text-sm mb-6">
          Typically 12 (sometimes 18, 24) words separated by single spaces
        </VText>

        {/* Import button */}
        <VButton
          variant="primary"
          title={submitting ? 'Importing...' : 'Import Wallet'}
          onPress={onImport}
          disabled={!isValid || submitting}
          className={!isValid || submitting ? 'opacity-50' : ''}
        />

        {submitting && (
          <View className="mt-4 items-center">
            <ActivityIndicator size="small" color="#888" />
            <VText className="text-muted text-sm mt-2">Deriving wallet addresses...</VText>
          </View>
        )}

        {/* Word count */}
        <View className="mt-4 items-center">
          <VText className="text-xs text-muted">
            {wordCount ? `${wordCount} words` : ' '}
          </VText>
        </View>
      </View>
    </View>
  );
}
