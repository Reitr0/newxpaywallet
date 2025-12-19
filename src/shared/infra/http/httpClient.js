// src/shared/http/httpClient.js
import axios from 'axios';
import logService from '@src/shared/infra/log/logService';
import { _makeKey as makeKey, get as cacheGet, set as cacheSet } from '@src/shared/infra/http/httpCache';


/**
 * Create a scoped axios client with:
 *  - Logging
 *  - Retries (exponential backoff, jitter, Retry-After)
 *  - Simple TTL caching (per-request via config.cacheTtl or global default)
 *
 * @param {object} opts
 * @param {string} opts.baseURL
 * @param {string} [opts.name='api']
 * @param {number} [opts.timeout=15000]
 * @param {object} [opts.headers]
 *
 * // Retry options
 * @param {number} [opts.retries=2]
 * @param {number} [opts.retryDelayBase=300]
 * @param {number} [opts.retryDelayMax=8000]
 * @param {number} [opts.backoffMultiplier=2]
 * @param {boolean} [opts.jitter=true]
 * @param {string[]} [opts.retryMethods=['get','head','options']]
 * @param {number[]} [opts.retryOnStatus=[408,429,500,502,503,504]]
 * @param {boolean} [opts.retryPost=false]
 *
 * // Cache options
 * @param {number} [opts.defaultCacheTtl=0]  // 0 = off globally; override per-request with config.cacheTtl
 */
export function createHttpClient({
                                   baseURL,
                                   name = "api",
                                   timeout = 15000,
                                   headers = {},

                                   // retry
                                   retries = 2,
                                   retryDelayBase = 300,
                                   retryDelayMax = 8000,
                                   backoffMultiplier = 2,
                                   jitter = true,
                                   retryMethods = ["get", "head", "options"],
                                   retryOnStatus = [408, 429, 500, 502, 503, 504],
                                   retryPost = false,

                                   // cache
                                   defaultCacheTtl = 0,
                                 } = {}) {
  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  // -------------------- Retry helpers --------------------
  const shouldRetry = (error, attempt) => {
    const cfg = error?.config;
    if (!cfg) return false;

    const isNetworkError =
      !error.response && (error.code === "ECONNABORTED" || error.message === "Network Error");

    const status = error.response?.status;
    const method = (cfg.method || "get").toLowerCase();

    const methods = retryPost ? [...retryMethods, "post"] : retryMethods;
    if (!methods.includes(method)) return false;

    const statusRetryable = status ? retryOnStatus.includes(status) : isNetworkError;
    return attempt < retries && statusRetryable;
  };

  const computeDelay = (attempt, retryAfterHeader) => {
    if (retryAfterHeader) {
      const secs = Number(retryAfterHeader);
      if (Number.isFinite(secs) && secs >= 0) {
        return Math.min(secs * 1000, retryDelayMax);
      }
    }
    let delay = Math.min(retryDelayBase * Math.pow(backoffMultiplier, attempt), retryDelayMax);
    if (jitter) {
      const delta = delay * 0.2;
      delay = delay + (Math.random() * 2 - 1) * delta;
      delay = Math.max(0, Math.round(delay));
    }
    return delay;
  };

  // -------------------- Caching via adapter override --------------------
  // We short-circuit the request when a fresh cache entry exists by swapping the adapter.
  client.interceptors.request.use((config) => {
    // metadata
    config.metadata = {
      start: Date.now(),
      name,
      attempt: config.metadata?.attempt ?? 0,
    };

    const method = (config.method || "get").toLowerCase();
    const cacheTtl = config.cacheTtl ?? defaultCacheTtl;

    logService.debug("request", {
      name,
      method: method.toUpperCase(),
      url: (config.baseURL || "") + (config.url || ""),
      attempt: config.metadata.attempt,
      cacheTtl,
    });

    // Only cache GET/HEAD/OPTIONS by default (safe methods)
    const cacheEligible = cacheTtl > 0 && ["get", "head", "options"].includes(method);
    if (cacheEligible) {
      const fullUrl = (config.baseURL || "") + (config.url || "");
      const key = makeKey(fullUrl, config.params);

      const cached = cacheGet(fullUrl, config.params);
      if (cached !== null) {
        // Short-circuit by providing a custom adapter that returns a cached response
        config.adapter = async () => {
          const ms = Date.now() - (config.metadata?.start || Date.now());
          logService.debug("cache hit", {
            name: config.metadata?.name || name,
            url: fullUrl,
            ms,
          });

          return {
            data: cached,
            status: 200,
            statusText: "OK",
            headers: { "x-cache": "HIT" },
            config,
            request: null,
          };
        };
        return config;
      }

      // If no hit: keep the original adapter; we'll store on response
      config._cache = { key, ttl: cacheTtl, fullUrl };
    }

    return config;
  });

  client.interceptors.response.use(
    (res) => {
      const ms = Date.now() - (res.config.metadata?.start || Date.now());
      logService.debug("response", {
        name: res.config.metadata?.name || name,
        status: res.status,
        url: (res.config.baseURL || "") + (res.config.url || ""),
        ms,
        attempt: res.config.metadata?.attempt ?? 0,
      });

      // Store in cache if requested
      const c = res.config._cache;
      if (c && c.ttl > 0 && res.status === 200) {
        cacheSet(c.fullUrl, res.config.params, res.data, c.ttl);
      }

      return res;
    },
    async (err) => {
      const cfg = err.config || {};
      cfg.metadata = cfg.metadata || { start: Date.now(), name, attempt: 0 };

      const attempt = cfg.metadata.attempt ?? 0;
      const ms = Date.now() - (cfg.metadata.start || Date.now());
      const status = err.response?.status;
      const data = err.response?.data;

      logService.debug("response error", {
        name: cfg.metadata.name || name,
        status,
        url: (cfg.baseURL || "") + (cfg.url || ""),
        ms,
        attempt,
        data: typeof data === "string" ? data.slice(0, 500) : data,
        message: err.message,
      });

      // Retry logic
      if (shouldRetry(err, attempt)) {
        const retryAfter = err.response?.headers?.["retry-after"];
        const delay = computeDelay(attempt, retryAfter);

        logService.debug("retrying", {
          name: cfg.metadata.name || name,
          url: (cfg.baseURL || "") + (cfg.url || ""),
          nextAttempt: attempt + 1,
          waitMs: delay,
          status,
        });

        await new Promise((r) => setTimeout(r, delay));
        cfg.metadata.attempt = attempt + 1;
        return client(cfg);
      }

      // Normalize and throw
      const norm = new Error(
        typeof data === "string" ? data : data?.message || err.message || "HTTP error"
      );
      norm.status = status;
      norm.data = data;
      norm.url = (cfg.baseURL || "") + (cfg.url || "");
      throw norm;
    }
  );

  // --------------- Small helper wrappers (optional) ----------------
  // You can call these to avoid repeating { cacheTtl } in config.
  client.getCached = (url, { params, headers, cacheTtl = defaultCacheTtl, ...rest } = {}) =>
    client.get(url, { params, headers, cacheTtl, ...rest });

  return client;
}

/**
 * Optional: a shared "no-baseURL" client for full URLs.
 * Prefer per-service clients via createHttpClient to keep logs & limits scoped.
 */
export const http = createHttpClient({ name: "global", baseURL: "" });
