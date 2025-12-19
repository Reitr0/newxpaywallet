// src/features/dapps/service/confirmDialog.js
let _sheetRef = null;

export function setConfirmSheetRef(ref) {
  _sheetRef = ref;
}

/**
 * confirmDialog(title, message, options?)
 * options: { variant?: 'connect'|'sign'|'tx'|'switch'|'custom', confirmText?, cancelText?, extra? }
 * returns Promise<boolean>
 */
export function confirmDialog(title, message, options = {}) {
  return new Promise((resolve) => {
    if (!_sheetRef || typeof _sheetRef.present !== 'function') {
      // fallback: approve by default if sheet not mounted
      resolve(true);
      return;
    }
    _sheetRef.present({
      title,
      message,
      options,
      onApprove: () => resolve(true),
      onReject: () => resolve(false),
    });
  });
}
