// src/features/auth/state/authStore.js
import { proxy, useSnapshot } from 'valtio';
import log from '@src/shared/infra/log/logService';
import { authService } from '@src/features/auth/service/authService';

const persisted = authService.get();

export const authStore = proxy({
  // session-only
  isAuthenticated: false,

  // persisted flags
  hasWallet:       persisted.hasWallet,
  acceptedTos:     persisted.acceptedTos,
  completedBackup: persisted.completedBackup,
  user:            persisted.user,
  hasPin:          persisted.hasPin,
  biometricEnabled:persisted.biometricEnabled,
  locked:          persisted.locked,
  failedAttempts:  persisted.failedAttempts,
  lockUntil:       persisted.lockUntil,
  pinHash:         persisted.pinHash,

  // 👇 NEW persisted fields
  lockMethod:      persisted.lockMethod,
  autoLock:        persisted.autoLock,
  lastBackgroundAt:persisted.lastBackgroundAt,

  _applySaved(saved) {
    const sessionAuth = authStore.isAuthenticated;
    Object.assign(authStore, saved);
    authStore.isAuthenticated = sessionAuth;
  },

  // session controls
  setAuthenticated(v) { authStore.isAuthenticated = !!v; },

  // service-backed actions
  signIn(user)            { authStore._applySaved(authService.signIn(user)); },
  signOut()               { authStore._applySaved(authService.signOut()); authStore.isAuthenticated = false; },
  setHasWallet(v)         { authStore._applySaved(authService.setHasWallet(v)); },
  markAcceptedTos()       { authStore._applySaved(authService.markAcceptedTos()); },
  completeBackup()        { authStore._applySaved(authService.completeBackup()); },

  async initializePin()   { authStore._applySaved(await authService.initializePin()); },
  async setPin(pin) {
    if (!pin || String(pin).length < 4) return 'weak';
    const saved = await authService.setPin(pin);
    authStore._applySaved(saved);
    return saved?.hasPin ? 'success' : 'weak';
  },
  authenticate(pin) {
    const okOrDoc = authService.authenticate(pin);
    authStore._applySaved(authService.get());
    return !!okOrDoc && authStore.locked === false;
  },
  lock()                  { authStore._applySaved(authService.lock()); },
  unlock()                { authStore._applySaved(authService.unlock()); },
  enableBiometric()       { authStore._applySaved(authService.enableBiometric()); },
  disableBiometric()      { authStore._applySaved(authService.disableBiometric()); },

  // 👇 NEW: lock method + auto-lock
  setLockMethod(method)   { authStore._applySaved(authService.setLockMethod(method)); },
  setAutoLock(presetKey)  { authStore._applySaved(authService.setAutoLock(presetKey)); },
  markBackground()        { authStore._applySaved(authService.markBackground()); },
  maybeAutoLockOnResume() { authStore._applySaved(authService.maybeAutoLockOnResume()); },

  getInitialRoute()       { return authService.getInitialRoute(); },

  clearAuth() {
    log.warn('[authStore] clearAuth');
    authStore._applySaved(authService.clearAuth());
    authStore.isAuthenticated = false;
  },
});

export function useAuth() { return useSnapshot(authStore); }
export function shouldShowLockScreen() { return authService.shouldShowLockScreen(); }
