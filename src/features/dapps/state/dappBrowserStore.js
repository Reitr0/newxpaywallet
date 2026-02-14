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
  
  // Check if current site should auto-connect
  shouldAutoConnect() {
    return this.AUTO_CONNECT_HOSTS.has(this.host) || 
           this.host.includes('solxdapp') ||
           this.host.includes('pancake') ||
           this.host.includes('uniswap') ||
           this.url.includes('solxdapp') ||
           this.url.includes('Solxdapp');
  },

  /* -------- wallet mirror (reactive) -------- */
  activeAddress: null,      // will be synced from walletStore
  activeChainId: 1,         // default to Ethereum mainnet
  activeChainHex: '0x1',    // hex string (e.g., '0x1')

  /* -------- derived helpers -------- */
  getHost,
  getOrigin,
  getFavicon,
  toHexChainId,

  /* ================= actions ================= */

  // CRITICAL: Sync wallet state from walletStore
  syncWalletState() {
    try {
      // For BSC/BEP20 DApps, prioritize BSC address
      let activeAddress = null;
      let activeChainId = 56; // BSC mainnet
      
      // Check if we're on a BSC-related site
      const isBscSite = this.host.includes('bsc') || 
                       this.host.includes('pancake') || 
                       this.host.includes('binance') ||
                       this.host.includes('solxdapp') || 
                       this.host.includes('Solxdapp') || // ✅ ADD THIS
                       this.url.includes('bsc') ||
                       this.url.includes('bnb') ||
                       this.url.includes('solxdapp') ||
                       this.url.includes('solxdapp');// ✅ ADD THIS
      
      console.log('[DApp Browser] Checking BSC site:', { 
        host: this.host, 
        url: this.url, 
        isBscSite 
      });
      
      if (isBscSite) {
        // Use BSC address for BSC sites
        activeAddress = walletStore.getWalletAddressByChain('bsc');
        activeChainId = 56; // BSC mainnet
        console.log('[DApp Browser] BSC site detected, using BSC wallet:', activeAddress);
      } else {
        // Use Ethereum address for other sites
        activeAddress = walletStore.getWalletAddressByChain('ethereum');
        activeChainId = 1; // Ethereum mainnet
        console.log('[DApp Browser] Using Ethereum wallet:', activeAddress);
      }
      
      if (activeAddress && (activeAddress !== this.activeAddress || activeChainId !== this.activeChainId)) {
        this.activeAddress = activeAddress.toLowerCase();
        this.activeChainId = activeChainId;
        this.activeChainHex = toHexChainId(activeChainId);
        console.log('[DApp Browser] Synced active address:', this.activeAddress, 'Chain:', activeChainId, 'Hex:', this.activeChainHex);
      }
      
      // Fallback to Ethereum if no address found
      if (!this.activeAddress) {
        const ethAddress = walletStore.getWalletAddressByChain('ethereum');
        if (ethAddress) {
          this.activeAddress = ethAddress.toLowerCase();
          this.activeChainId = 1;
          this.activeChainHex = '0x1';
          console.log('[DApp Browser] Fallback to Ethereum address:', this.activeAddress);
        }
      }
    } catch (e) {
      console.warn('[DApp Browser] Failed to sync wallet state:', e.message);
    }
  },

  // Set active wallet manually (for chain switching)
  setActiveWallet(address, chainId) {
    this.activeAddress = address ? address.toLowerCase() : null;
    this.activeChainId = chainId || 1;
    this.activeChainHex = toHexChainId(chainId || 1);
    console.log('[DApp Browser] Set active wallet:', { address: this.activeAddress, chainId: this.activeChainId });
  },

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
