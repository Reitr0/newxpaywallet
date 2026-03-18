// src/features/wallet/blockchain/providers/slxProvider.js
import axios from 'axios';
import logService from '@src/shared/infra/log/logService';
import { formatEther, formatUnits } from 'ethers';

const SLX_EXPLORER_API = 'https://slxscan.io/api';

// ── Rate limiter ──
const MIN_INTERVAL = 5000; // 5s between requests
const MAX_RETRIES = 3;
let _lastRequestTime = 0;
const _queue = [];
let _processing = false;

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function _processQueue() {
    if (_processing) return;
    _processing = true;
    while (_queue.length > 0) {
        const { fn, resolve, reject } = _queue.shift();
        const elapsed = Date.now() - _lastRequestTime;
        if (elapsed < MIN_INTERVAL) await _sleep(MIN_INTERVAL - elapsed);
        try {
            _lastRequestTime = Date.now();
            resolve(await fn());
        } catch (e) {
            reject(e);
        }
    }
    _processing = false;
}

function rateLimitedGet(url, config) {
    return new Promise((resolve, reject) => {
        const fn = async () => {
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    return await axios.get(url, config);
                } catch (e) {
                    if (e?.response?.status === 429 && attempt < MAX_RETRIES) {
                        const wait = (attempt + 1) * 5000;
                        logService.warn(`slxProvider: 429, retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms`);
                        await _sleep(wait);
                        _lastRequestTime = Date.now();
                        continue;
                    }
                    throw e;
                }
            }
        };
        _queue.push({ fn, resolve, reject });
        _processQueue();
    });
}

// ── Stale-while-revalidate cache (in-memory) ──
const _cache = new Map(); // cacheKey → { data: [], ts: number }
const CACHE_TTL = 30 * 1000; // 30s before background refresh triggered

function _cacheKey(address, action, contractAddr) {
    return contractAddr ? `${address}_${action}_${contractAddr}` : `${address}_${action}`;
}

// Normalize Etherscan-style response to Moralis-like format
function _normalize(result, isTokenTransfer) {
    if (!Array.isArray(result)) return [];
    return result.map(tx => ({
        hash: tx.hash,
        transaction_hash: tx.hash,
        from_address: tx.from,
        to_address: tx.to,
        value: tx.value || '0',
        value_decimal: isTokenTransfer
            ? formatUnits(tx.value || '0', parseInt(tx.tokenDecimal || '18', 10))
            : formatEther(tx.value || '0'),
        block_number: tx.blockNumber,
        block_timestamp: tx.timeStamp
            ? new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString()
            : null,
        token_symbol: tx.tokenSymbol || null,
        token_decimals: tx.tokenDecimal || null,
        gas: tx.gas,
        gas_used: tx.gasUsed,
        gas_price: tx.gasPrice,
        is_error: tx.isError === '1',
    }));
}

// Fire-and-forget API fetch → update cache when done
function _refreshInBackground(url, apiParams, cKey, isTokenTransfer) {
    rateLimitedGet(url, { params: apiParams, timeout: 15000 })
        .then(response => {
            const normalized = _normalize(response?.data?.result, isTokenTransfer);
            if (normalized.length > 0) {
                _cache.set(cKey, { data: normalized, ts: Date.now() });
            }
        })
        .catch(err => {
            logService.warn(`slxProvider: bg refresh failed (${err?.response?.status ?? err?.message})`);
        });
}

export const slxProvider = {
    txHistoryProvider: () => ({
        async get(endpoint, config = {}) {
            const params = config.params || {};
            let address = '';
            let isTokenTransfer = false;

            const walletMatch = endpoint.match(/\/wallets\/(0x[a-fA-F0-9]+)\/history/);
            const tokenMatch  = endpoint.match(/\/(0x[a-fA-F0-9]+)\/erc20\/transfers/);

            if (walletMatch)      { address = walletMatch[1]; }
            else if (tokenMatch)  { address = tokenMatch[1]; isTokenTransfer = true; }

            if (!address) return { data: { result: [] } };

            const action      = isTokenTransfer ? 'tokentx' : 'txlist';
            const contractAddr = isTokenTransfer ? (params.contract_addresses || null) : null;
            const cKey        = _cacheKey(address, action, contractAddr);
            const cached      = _cache.get(cKey);

            // API params — always fetch latest 20
            const apiParams = {
                module: 'account',
                action,
                address,
                page: 1,
                offset: 20,
                sort: 'desc',
                ...(contractAddr ? { contractaddress: contractAddr } : {}),
            };

            // ── Stale-while-revalidate ──
            // If ANY cached data exists → return it immediately (instant UX)
            // Then if stale → trigger background refresh
            if (cached?.data?.length > 0) {
                if (Date.now() - cached.ts >= CACHE_TTL) {
                    // Stale: kick off background refresh, return old data now
                    _refreshInBackground(SLX_EXPLORER_API, apiParams, cKey, isTokenTransfer);
                }
                // Always return cache instantly
                return { data: { result: cached.data } };
            }

            // No cache at all → first load, must fetch and wait
            try {
                const response = await rateLimitedGet(SLX_EXPLORER_API, {
                    params: apiParams,
                    timeout: 15000,
                });
                const normalized = _normalize(response?.data?.result, isTokenTransfer);
                _cache.set(cKey, { data: normalized, ts: Date.now() });
                return { data: { result: normalized } };
            } catch (e) {
                logService.warn(`slxProvider: first load failed (${e?.response?.status ?? e?.message})`);
                // Return empty so History shows empty state, not crash
                return { data: { result: [] } };
            }
        },
    }),
};
