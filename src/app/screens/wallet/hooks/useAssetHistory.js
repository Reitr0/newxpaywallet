// src/pages/asset/hooks/useAssetHistory.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { walletStore } from '@features/wallet/state/walletStore';
import logService from '@src/shared/infra/log/logService';

export default function useAssetHistory({ chain, tokenAddress, pageSize = 20 }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Refs to avoid loops/thrashing
  const cursorRef = useRef(undefined);
  const inFlightRef = useRef(false);
  const seenRef = useRef(new Set()); // ✅ dedupe by tx hash
  const key = useMemo(() => `${chain || ''}::${tokenAddress || ''}`, [chain, tokenAddress]);

  const reset = useCallback(() => {
    setItems([]);
    setCursor(undefined);
    cursorRef.current = undefined;
    seenRef.current = new Set(); // ✅ reset dedupe set
    setError(null);
  }, []);

  // Normalize + dedupe helper
  const appendPage = useCallback((pageItems, mode) => {
    const incoming = Array.isArray(pageItems) ? pageItems : [];
    const unique = [];

    for (const tx of incoming) {
      const h = String(tx?.hash || tx?.txid || '');
      if (!h) continue;
      if (seenRef.current.has(h)) continue; // ✅ skip duplicates
      seenRef.current.add(h);
      unique.push(tx);
    }
    setItems(prev => (mode === 'more' ? [...prev, ...unique] : unique));
  }, []);

  const fetchPage = useCallback(
    async (mode = 'initial') => {
      if (!chain || inFlightRef.current) return;

      try {
        inFlightRef.current = true;
        if (mode === 'initial') setLoading(true);
        if (mode === 'refresh') setRefreshing(true);
        if (mode === 'more')    setLoadingMore(true);

        const res = await walletStore.getTransactionHistory({
          chain,
          tokenAddress,
          limit: pageSize,
          cursor: mode === 'more' ? cursorRef.current : undefined,
        });

        const nextItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const nextCursor = res?.cursor;

        appendPage(nextItems, mode);     // ✅ dedup-aware append/replace
        setCursor(nextCursor);
        cursorRef.current = nextCursor;
        setError(null);
      } catch (e) {
        const msg = e?.message || 'Failed to load history';
        logService.warn('useAssetHistory fetch failed', { chain, tokenAddress, message: msg });
        setError(msg);
        if (mode !== 'more') {
          setItems([]);
          seenRef.current = new Set();
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [chain, tokenAddress, pageSize, appendPage]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      reset();
      if (!cancelled) await fetchPage('initial');
    })();
    return () => { cancelled = true; };
  }, [key, reset, fetchPage]);

  const onRefresh = useCallback(() => {
    if (!inFlightRef.current) fetchPage('refresh');
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (cursorRef.current && !loading && !loadingMore && !inFlightRef.current) {
      fetchPage('more');
    }
  }, [fetchPage, loading, loadingMore]);

  return {
    items,
    cursor,
    loading,
    refreshing,
    loadingMore,
    error,
    onRefresh,
    loadMore,
    retry: () => fetchPage('initial'),
    hasMore: !!cursorRef.current,
  };
}
