// src/pages/asset/hooks/useAssetHistory.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { walletStore } from '@features/wallet/state/walletStore';
import logService from '@src/shared/infra/log/logService';

export default function useAssetHistory({ chain, tokenAddress, pageSize = 20 }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const cursorRef = useRef(undefined);
  const inFlightRef = useRef(false);
  const seenRef = useRef(new Set());
  const lastLoadMoreTime = useRef(0);
  const emptyFetchCount = useRef(0);

  const fetchPage = async (mode = 'initial', currentChain, currentTokenAddress) => {
    if (!currentChain || inFlightRef.current) return;

    try {
      inFlightRef.current = true;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);

      const res = await walletStore.getTransactionHistory({
        chain: currentChain,
        tokenAddress: currentTokenAddress,
        limit: pageSize,
        cursor: mode === 'more' ? cursorRef.current : undefined,
      });

      const nextItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      const nextCursor = res?.cursor;

      // --- DEDUPLICATION FIX START ---
      const unique = [];
      
      for (const tx of nextItems) {
        const h = String(tx?.hash || tx?.txid || '');
        const dir = String(tx?.direction || 'unknown'); // Get direction
        
        if (!h) continue;

        // Create Composite Key: Hash + Direction
        // This ensures Incoming and Outgoing in the same tx (Swaps) are BOTH kept
        const uniqueKey = `${h}_${dir}`;

        if (seenRef.current.has(uniqueKey)) continue;
        
        seenRef.current.add(uniqueKey);
        unique.push(tx);
      }
      // --- DEDUPLICATION FIX END ---

      const sortByTime = (a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      };

      setItems(prev => {
        // Clear previous items on refresh/initial to prevent stale data
        const base = (mode === 'initial' || mode === 'refresh') ? [] : prev;
        const merged = [...base, ...unique];
        return merged.sort(sortByTime);
      });
      
      // Pagination Logic
      if (mode === 'more') {
        if (unique.length === 0) emptyFetchCount.current += 1;
        else emptyFetchCount.current = 0;
        
        if (emptyFetchCount.current >= 1 || !nextCursor) {
          setCursor(undefined);
          cursorRef.current = undefined;
        } else {
          setCursor(nextCursor);
          cursorRef.current = nextCursor;
        }
      } else {
        emptyFetchCount.current = 0;
        setCursor(nextCursor);
        cursorRef.current = nextCursor;
      }
      setError(null);
    } catch (e) {
      const msg = e?.message || 'Failed to load history';
      logService.warn('useAssetHistory fetch failed', { chain: currentChain, tokenAddress: currentTokenAddress, message: msg });
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
  };

  useEffect(() => {
    // Reset Everything on Chain/Token Change
    setItems([]);
    setCursor(undefined);
    cursorRef.current = undefined;
    seenRef.current = new Set();
    setError(null);
    inFlightRef.current = false;
    
    if (!chain) return;
    fetchPage('initial', chain, tokenAddress);
  }, [chain, tokenAddress, pageSize]);

  const onRefresh = useCallback(() => {
    seenRef.current = new Set(); // Clear cache on refresh
    fetchPage('refresh', chain, tokenAddress);
  }, [chain, tokenAddress, pageSize]);

  const loadMore = useCallback(() => {
    if (!cursorRef.current) return;
    if (loading || loadingMore || inFlightRef.current) return;
    
    const now = Date.now();
    if (now - lastLoadMoreTime.current < 500) return;
    lastLoadMoreTime.current = now;
    
    fetchPage('more', chain, tokenAddress);
  }, [chain, tokenAddress, pageSize, loading, loadingMore]);

  const retry = useCallback(() => {
    seenRef.current = new Set();
    fetchPage('initial', chain, tokenAddress);
  }, [chain, tokenAddress, pageSize]);

  return {
    items,
    cursor,
    loading,
    refreshing,
    loadingMore,
    error,
    onRefresh,
    loadMore,
    retry,
    hasMore: !!cursor,
  };
}