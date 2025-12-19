// src/features/dapps/ui/confirm/dappConfirmSheetStore.js
import { proxy } from 'valtio';

/**
 * Sheet state + resolver store
 * - open(payload) -> Promise<boolean | any>
 * - resolve(value) / reject(err) will also close the sheet
 */
export const dappConfirmSheetStore = proxy({
    isOpen: false,
    // payload drives the UI contents
    payload: {
        title: '',
        message: '',
        variant: 'default', // 'connect' | 'sign' | 'typed' | 'tx' | 'network' | 'default'
        primaryLabel: 'Approve',
        cancelLabel: 'Cancel',
        // optional preview fields (used by variants)
        address: null,
        chainIdHex: null,
        tx: null,
        typedDataPreview: null,
    },

    _resolver: null, // (value) => void
    _rejecter: null, // (err) => void

    open(input) {
        // normalize payload
        this.payload = {
          title: input?.title || '',
          message: input?.message || '',
          variant: input?.variant || 'default',
          primaryLabel: input?.primaryLabel || 'Approve',
          cancelLabel: input?.cancelLabel || 'Cancel',
          address: input?.address ?? null,
          chainIdHex: input?.chainIdHex ?? null,
          tx: input?.tx ?? null,
          typedDataPreview: input?.typedDataPreview ?? null,
        };

        this.isOpen = true;

        return new Promise((resolve, reject) => {
            this._resolver = resolve;
            this._rejecter = reject;
        });
    },

    resolve(value) {
        if (this._resolver) this._resolver(value);
        this._resolver = null;
        this._rejecter = null;
        this.isOpen = false;
    },

    reject(err) {
        if (this._rejecter) this._rejecter(err || new Error('rejected'));
        this._resolver = null;
        this._rejecter = null;
        this.isOpen = false;
    },

    close() {
        // default cancel behavior resolves to false
        if (this._resolver) this._resolver(false);
        this._resolver = null;
        this._rejecter = null;
        this.isOpen = false;
    },
});
