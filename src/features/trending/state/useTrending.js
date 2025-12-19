// src/features/trending/hooks/useTrending.js
import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { loadTrending, trendingStore } from '@src/features/trending/state/trendingStore';


export default function useTrending({ chain, window, blocking = false } = {}) {
  const snap = useSnapshot(trendingStore);

  // Update filters if props change
  useEffect(() => {
    const next = {};
    if (chain && chain !== snap.filters.chain) next.chain = chain;
    if (window && window !== snap.filters.window) next.window = window;
    if (Object.keys(next).length) trendingStore.setFilters(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, window]);

  // Load on mount / filter change
  useEffect(() => {
    loadTrending({ blocking });
  }, [snap.filters.chain, snap.filters.window, blocking]);

  return snap; // {entities, status, error, filters, lastUpdated}
}
