// src/features/browser/state/dappBrowserStore.js
import { proxy } from 'valtio';
import { walletStore } from '@features/wallet/state/walletStore';

/* ---------------- allowlist + helpers ---------------- */
const AUTO_CONNECT_HOSTS = new Set(['app.uniswap.org', 'pancakeswap.finance']);

const getHost = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const getOrigin = (u) => { try { return new URL(u).origin; } catch { return ''; } };
const getFavicon = (u) => {
  const h = getHost(u);
  if (!h) return null;
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(h)}`;
};
const toHexChainId = (n) => (n == null ? null : ('0x' + Number(n).toString(16)));

/* ---------------- store ---------------- */
export const dappBrowserStore = proxy({
  /* -------- nav + ui -------- */
  url: '',
  canGoBack: false,
  canGoForward: false,
  loading: false,
  progress: 0,

  /* -------- chrome-like header -------- */
  host: '',
  isSecure: true,
  favicon: null,
  showUrlInput: false,

  /* -------- favorites -------- */
  favs: new Set(),

  /* -------- permissions (origin -> { connected, address, chainId? }) -------- */
  sitePermissions: new Map(),

  /* -------- allowlist -------- */
  AUTO_CONNECT_HOSTS,

  /* -------- wallet mirror (reactive) -------- */
  activeAddress: walletStore.getWalletAddressByChain('ethereum'),      // lowercase string
  activeChainId: null,      // number (e.g., 1, 56)
  activeChainHex: null,     // hex string (e.g., '0x1')

  /* -------- derived helpers -------- */
  getHost,
  getOrigin,
  getFavicon,
  toHexChainId,

  /* ================= actions ================= */

  // init / set url
  setInitialUrl(u) {
    this.url = u;
    this.host = getHost(u);
    this.isSecure = /^https:\/\//i.test(u);
    this.favicon = getFavicon(u);
  },
  setUrl(u) {
    this.url = u;
    this.host = getHost(u);
    this.isSecure = /^https:\/\//i.test(u);
    this.favicon = getFavicon(u);
  },

  // nav state
  setNavState({ canGoBack, canGoForward }) {
    this.canGoBack = !!canGoBack;
    this.canGoForward = !!canGoForward;
  },
  setLoading(v) { this.loading = !!v; },
  setProgress(p) { this.progress = Math.max(0, Math.min(1, Number(p || 0))); },
  toggleUrlInput() { this.showUrlInput = !this.showUrlInput; },

  // favorites
  toggleFav() {
    const h = this.host;
    const next = new Set(this.favs);
    if (next.has(h)) next.delete(h); else next.add(h);
    this.favs = next;
  },

  // auto-connect allowlist
  allowAutoConnectFor(u) {
    const h = getHost(u);
    return this.AUTO_CONNECT_HOSTS.has(h);
  },

  // permissions
  setPermission(origin, { connected, address, chainId = null }) {
    const addr = address ? String(address).toLowerCase() : null;
    this.sitePermissions.set(origin, { connected: !!connected, address: addr, chainId });
  },
  getPermission(origin) {
    return this.sitePermissions.get(origin) || { connected: false, address: null, chainId: null };
  },
  clearPermission(origin) {
    this.sitePermissions.delete(origin);
  },

  /* -------- wallet mirror setters (call these from a wallet-sync effect) -------- */
  setActiveWallet(address, chainId) {
    const addr = address ? String(address).toLowerCase() : null;
    this.activeAddress = addr;
    this.activeChainId = (chainId == null ? null : Number(chainId));
    this.activeChainHex = toHexChainId(this.activeChainId);
  },
  setActiveAddress(address) {
    const addr = address ? String(address).toLowerCase() : null;
    this.activeAddress = addr;
  },
  setActiveChainId(chainId) {
    this.activeChainId = (chainId == null ? null : Number(chainId));
    this.activeChainHex = toHexChainId(this.activeChainId);
  },

  /* -------- selectors used by the screen/router -------- */
  getActiveAddress() { return this.activeAddress; },
  getActiveChainId() { return this.activeChainId; },
  getActiveChainHex() { return this.activeChainHex; },

  /* -------- convenience: connect current origin (used for auto-connect) -------- */
  connectOriginForUrl(u) {
    const origin = getOrigin(u);
    if (!origin || !this.activeAddress) return;
    this.setPermission(origin, {
      connected: true,
      address: this.activeAddress,
      chainId: this.activeChainId,
    });
  },
});
