// src/features/auth/service/authService.js
import db from '@src/shared/infra/db/db';
import { sha256 } from 'ethers';

// --- new constants
const AUTOLOCK_PRESETS = {
  immediate: 0,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 5 * 60_000,
  '10m': 10 * 60_000,
};

const DEFAULTS = {
  v: 1,
  isAuthenticated: false, // session-only
  hasWallet: false,
  acceptedTos: false,
  completedBackup: false,
  user: null,

  hasPin: false,
  biometricEnabled: false,

  locked: true,
  failedAttempts: 0,
  lockUntil: 0,
  pinHash: null,

  // 👇 NEW
  lockMethod: 'passcode',     // 'passcode' | 'biometric'
  autoLock: 'immediate',      // keys in AUTOLOCK_PRESETS
  lastBackgroundAt: 0,        // timestamp for auto-lock checks
};

const authDoc = db.doc('auth.state.v1', {
  defaults: DEFAULTS,
  decode: (raw) => ({ ...DEFAULTS, ...(raw || {}) }),
  encode: (val) => val,
});

// ---- session flag unchanged ----
let sessionAuth = false;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const MIN_PIN_LEN = 4;
const now = () => Date.now();
const hashPin = (pin) => {
  try { return sha256(new TextEncoder().encode(String(pin))); }
  catch { return null; }
};

export const authService = {
  get() {
    const doc = authDoc.get();
    return { ...doc, isAuthenticated: sessionAuth };
  },

  update(patch) {
    const { isAuthenticated, ...persistable } = patch || {};
    const saved = authDoc.patch((cur) => ({ ...cur, ...persistable }));
    return { ...saved, isAuthenticated: sessionAuth };
  },

  reset() {
    const saved = authDoc.reset() || authDoc.get();
    sessionAuth = false;
    return { ...saved, isAuthenticated: sessionAuth };
  },

  // ----- Session / onboarding -----
  signIn(user) {
    sessionAuth = true;
    const saved = this.update({
      user: user || { id: 'local' },
      locked: false,
      failedAttempts: 0,
      lockUntil: 0,
    });
    return { ...saved, isAuthenticated: true };
  },

  signOut() {
    sessionAuth = false;
    const saved = this.update({ user: null });
    return { ...saved, isAuthenticated: false };
  },

  setHasWallet(v)   { return this.update({ hasWallet: !!v }); },
  markAcceptedTos() { return this.update({ acceptedTos: true }); },
  completeBackup()  { return this.update({ completedBackup: true }); },

  // ----- Lock & PIN -----
  async initializePin(suppressLock) {
    const cur = authDoc.get();
    if (cur.hasPin && !cur.locked && !suppressLock) {
      return this.update({ locked: true });
    }
    return this.get(suppressLock);
  },

  async setPin(pin) {
    if (!pin || String(pin).length < MIN_PIN_LEN) return this.get();
    const digest = hashPin(pin);
    return this.update({
      pinHash: digest,
      hasPin: true,
      locked: false,
      failedAttempts: 0,
      lockUntil: 0,
    });
  },

  authenticate(pin) {
    const cur = authDoc.get();
    const t = now();
    if (cur.lockUntil && t < cur.lockUntil) return false;

    const ok = !!cur.pinHash && cur.pinHash === hashPin(pin);
    if (ok) {
      this.update({ locked: false, failedAttempts: 0, lockUntil: 0 });
      return this.get();
    }

    const attempts = (cur.failedAttempts || 0) + 1;
    const patch = { failedAttempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      patch.locked = true;
      patch.lockUntil = t + LOCKOUT_MS;
      patch.failedAttempts = 0;
    }
    this.update(patch);
    return false;
  },

  lock()   { return this.update({ locked: true }); },
  unlock() { return this.update({ locked: false, failedAttempts: 0, lockUntil: 0 }); },

  enableBiometric()  { return this.update({ biometricEnabled: true }); },
  disableBiometric() { return this.update({ biometricEnabled: false }); },

  // ===== NEW: Lock method + auto-lock =====
  setLockMethod(method) {
    // 'passcode' | 'biometric'
    return this.update({ lockMethod: method === 'biometric' ? 'biometric' : 'passcode' });
  },

  setAutoLock(presetKey) {
    const key = Object.prototype.hasOwnProperty.call(AUTOLOCK_PRESETS, presetKey)
      ? presetKey
      : 'immediate';
    return this.update({ autoLock: key });
  },

  /** Call on app going to background (pause) */
  markBackground() {
    return this.update({ lastBackgroundAt: now() });
  },

  /** Call on app resume; returns updated doc */
  maybeAutoLockOnResume() {
    const d = authDoc.get();
    if (!d.hasPin) return this.get();

    const delay = AUTOLOCK_PRESETS[d.autoLock] ?? 0;
    if (delay === 0) {
      // immediate lock on resume if autoLock=immediate
      return this.update({ locked: true });
    }

    const t = now();
    if (d.lastBackgroundAt && t - d.lastBackgroundAt >= delay) {
      return this.update({ locked: true });
    }
    return this.get();
  },

  clearAuth() {
    const saved = authDoc.reset() || authDoc.get();
    sessionAuth = false;
    return { ...saved, isAuthenticated: false };
  },

  getInitialRoute() {
    const d = this.get();
    if (!d.hasWallet) return 'Start';
    if (d.locked) return 'Lock';
    return 'App';
  },

  shouldShowLockScreen() {
    const d = this.get();
    const t = now();
    return !!(d.hasPin && (d.locked || (d.lockUntil && t < d.lockUntil)));
  },
};
