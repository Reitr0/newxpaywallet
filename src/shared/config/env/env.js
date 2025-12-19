// src/shared/config/env.js

/**
 * Central runtime environment config.
 * Works in both React Native & Node-like contexts.
 * Use for all shared clients: server, Binance, CoinGecko, etc.
 */

const ENV = {
  // Base URL for your own backend
  API_BASE_URL:
    process.env.API_BASE_URL ||
    (__DEV__ ? "http://10.0.2.2:8080" : "https://vprice-68e717fd25a6.herokuapp.com"),

  // Common timeouts (ms)
  API_TIMEOUT_MS: Number(process.env.API_TIMEOUT_MS || 15000),

  // Binance / CoinGecko (if any keys or proxies used)
  BINANCE_BASE_URL: "https://api.binance.com",
  COINGECKO_BASE_URL: "https://api.coingecko.com/api/v3",

  // If you use CoinGecko Pro or custom key
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || null,

  ZEROEX_API_URL: process.env.ZEROEX_API_URL || "https://api.0x.org/",
  ZEROEX_API_KEY: process.env.ZEROEX_API_KEY || "ca998e9d-92bf-477c-84c7-137ac6bdb4ae",
  ZEROEX_API_VERSION: process.env.ZEROEX_API_KEY || "v2",
  // Environment flags
  NODE_ENV: process.env.NODE_ENV || (__DEV__ ? "development" : "production"),
  IS_DEV: typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production",

  // Misc app metadata
  APP_VERSION: 1,
  MORALIS_API_URL: 'https://deep-index.moralis.io/api/v2.2/',
  MORALIS_API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjExY2VlNmIwLWZmM2QtNDNlNy04MDI4LWYxYTMzOWRkYzQ4ZCIsIm9yZ0lkIjoiMTUyNzA4IiwidXNlcklkIjoiMTUyMzUyIiwidHlwZUlkIjoiZDI3YTBjMzMtMTBlNS00OGYyLTljMzYtMDYzYTM4ZTRlZTQxIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE2ODYxMDMyNDMsImV4cCI6NDg0MTg2MzI0M30.cU47Bh5n91FDhQ3XatTjgY7ji5x0sL3kX88nSpXueYQ',

  TRON_API_URL: 'https://api.trongrid.io',
  TRON_API_KEY: '0327edd7-48f8-41a2-ab57-efa9f7ccfe5a',

};

module.exports = { ENV };
