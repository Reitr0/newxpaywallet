// src/shared/providers/bitcoin/bitcoinProvider.js
import { createHttpClient } from '@src/shared/infra/http/httpClient';
import logService from '@src/shared/infra/log/logService';
import { networkStore } from '@features/network/state/networkStore';
import { WALLET_FAMILY } from '@src/shared/config/chain/constants';


const { mempoolBase: base } = networkStore.getConfig(WALLET_FAMILY.BITCOIN);
const http = createHttpClient({ baseURL: base, name: 'mempool', timeout: 15000 });

const fetchJSON = async (path, opts) => {
  const { data } = await http.get(path, opts);
  return data;
};

export const bitcoinProvider = {
  listUnspent: async (address) => {
    try {
      const data = await fetchJSON(`/address/${address}/utxo`);
      logService.debug('listUnspent', { address, count: Array.isArray(data) ? data.length : 0 });
      return data;
    } catch (err) {
      logService.warn('listUnspent failed', { address, err: err.message });
      throw err;
    }
  },

  feeRateProvider: async () => {
    try {
      const data = await fetchJSON('/v1/fees/recommended');
      const fee = Number(data.halfHourFee || data.hourFee || data.fastestFee);
      if (!fee || Number.isNaN(fee)) throw new Error('Invalid fee response');
      logService.info('feeRateProvider', { fee });
      return fee;
    } catch (err) {
      logService.warn('feeRateProvider fallback', { err: err.message });
      return 10; // safe fallback
    }
  },

  broadcaster: async (rawHex) => {
    try {
      const { data: txid } = await http.post('/tx', rawHex, {
        headers: { 'content-type': 'text/plain' },
      });
      logService.info('broadcast success', { txid });
      return txid;
    } catch (err) {
      logService.warn('broadcast failed', { err: err.message });
      throw err;
    }
  },

  getHeight: async () => {
    try {
      const data = await fetchJSON('/blocks/tip/height');
      const height = Number(data);
      logService.debug('getHeight', { height });
      return height;
    } catch (err) {
      logService.warn('getHeight failed', { err: err.message });
      throw err;
    }
  },

  // Fetch full raw tx (for nonWitnessUtxo fallback)
  fetchRawTxHex: async (txid) => {
    try {
      const { data } = await http.get(`/tx/${txid}/hex`, {
        headers: { accept: 'text/plain' },
        responseType: 'text',
      });
      logService.debug('fetchRawTxHex success', { txid, length: data.length });
      return data;
    } catch (err) {
      logService.error('fetchRawTxHex failed', { txid, err: err.message });
      throw err;
    }
  },

  /**
   * ✅ History provider used by BtcWallet.getTransactionHistory
   *
   * - First page (no cursor): returns mempool + first confirmed page (merged, time desc)
   * - Next pages (with cursor): returns next confirmed page using last_seen
   * - `limit` is enforced client-side (mempool API page size is fixed ~25)
   *
   * @returns {Promise<{ items: any[], cursor?: string }>}
   */
  txHistoryProvider: async (address, { limit = 20, cursor } = {}) => {
    try {
      // Helper: sort by time desc (mempool txs may lack block_time; use received time fallback when present)
      const sortDesc = (a, b) => {
        const ta =
          (a?.status?.block_time ?? 0) ||
          (typeof a?.received_at === 'number' ? a.received_at : 0);
        const tb =
          (b?.status?.block_time ?? 0) ||
          (typeof b?.received_at === 'number' ? b.received_at : 0);
        return tb - ta;
      };

      // Confirmed pages:
      // - First page:  GET /address/:addr/txs             (latest confirmed)
      // - Next pages:  GET /address/:addr/txs/chain?last_seen=:txid
      let confirmed = [];
      let nextCursor;

      if (!cursor) {
        // First page → include mempool txs (optional), then confirmed page
        const [mempoolTxs, confirmedFirst] = await Promise.all([
          // unconfirmed mempool txs for this address
          fetchJSON(`/address/${address}/txs/mempool`).catch(() => []),
          fetchJSON(`/address/${address}/txs`).catch(() => []),
        ]);

        const merged = [...(Array.isArray(mempoolTxs) ? mempoolTxs : []), ...(Array.isArray(confirmedFirst) ? confirmedFirst : [])]
          .sort(sortDesc);

        // Enforce limit and determine cursor from the confirmed slice we used
        const memCount = Math.min(merged.length, Array.isArray(mempoolTxs) ? mempoolTxs.length : 0);
        const needFromConfirmed = Math.max(0, limit - memCount);
        const confirmedUsed = (Array.isArray(confirmedFirst) ? confirmedFirst : []).slice(0, needFromConfirmed);

        // Items to return
        const items = [
          ...(Array.isArray(mempoolTxs) ? mempoolTxs : []).slice(0, Math.min(limit, memCount)),
          ...confirmedUsed,
        ].sort(sortDesc);

        // If confirmed page exhausted the default page size, expose cursor for next page
        if (Array.isArray(confirmedFirst) && confirmedFirst.length > confirmedUsed.length) {
          // We already didn't consume the entire confirmed page => next cursor is the last txid we returned from confirmedUsed
          nextCursor = confirmedUsed.length ? confirmedUsed[confirmedUsed.length - 1]?.txid || confirmedUsed[confirmedUsed.length - 1]?.hash : undefined;
        } else if (Array.isArray(confirmedFirst) && confirmedFirst.length) {
          // If we used all confirmed page items and still want more later, cursor is the last txid in confirmedFirst
          nextCursor = confirmedFirst[confirmedFirst.length - 1]?.txid || confirmedFirst[confirmedFirst.length - 1]?.hash;
        }

        return { items, cursor: nextCursor };
      }

      // Next pages → only confirmed chain pages using last_seen cursor
      confirmed = await fetchJSON(`/address/${address}/txs/chain?last_seen=${cursor}`).catch(() => []);
      const items = (Array.isArray(confirmed) ? confirmed : []).slice(0, limit);

      // If we got a full page back (mempool default page size is ~25), set next cursor
      if (Array.isArray(confirmed) && confirmed.length > items.length) {
        nextCursor = items[items.length - 1]?.txid || items[items.length - 1]?.hash;
      } else if (Array.isArray(confirmed) && confirmed.length) {
        nextCursor = confirmed[confirmed.length - 1]?.txid || confirmed[confirmed.length - 1]?.hash;
      }

      return { items, cursor: nextCursor };
    } catch (err) {
      logService.warn('txHistoryProvider failed', { address, err: err?.message });
      throw err;
    }
  },
}
