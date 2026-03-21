// src/features/dapps/service/confirmDialog.js
let _sheetRef = null;
let _sheetReadyResolvers = [];

export function setConfirmSheetRef(ref) {
  _sheetRef = ref;
  // Resolve any pending waiters
  if (ref && typeof ref.present === 'function') {
    _sheetReadyResolvers.forEach(r => r());
    _sheetReadyResolvers = [];
  }
}

/**
 * Wait for the confirm sheet to become available (max 3s).
 * Returns true if sheet became available, false if timed out.
 */
function _waitForSheet(timeoutMs = 3000) {
  if (_sheetRef && typeof _sheetRef.present === 'function') {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // Remove this resolver from list
      _sheetReadyResolvers = _sheetReadyResolvers.filter(r => r !== done);
      resolve(false);
    }, timeoutMs);

    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    _sheetReadyResolvers.push(done);
  });
}

/**
 * confirmDialog(title, message, options?)
 * SECURITY: fail-closed — always rejects if sheet is unavailable or errors.
 * Waits up to 3s for sheet to mount before rejecting.
 * returns Promise<boolean>
 */
export function confirmDialog(title, message, options = {}) {
  return new Promise(async (resolve) => {
    // Wait for sheet to become available (handles mount race)
    const ready = await _waitForSheet(3000);
    if (!ready || !_sheetRef || typeof _sheetRef.present !== 'function') {
      // SECURITY: fail-closed — reject if sheet never became available
      console.warn('[confirmDialog] Sheet not available — rejecting');
      resolve(false);
      return;
    }

    // Guard the present() call itself
    try {
      _sheetRef.present({
        title,
        message,
        options,
        onApprove: () => resolve(true),
        onReject: () => resolve(false),
      });
    } catch (e) {
      // SECURITY: if present() throws, reject
      console.warn('[confirmDialog] present() failed — rejecting:', e?.message);
      resolve(false);
    }
  });
}
