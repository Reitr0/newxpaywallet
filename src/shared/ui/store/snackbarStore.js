import { proxy } from 'valtio';

export const snackbarStore = proxy({
  visible: false,
  message: '',
  type: 'info',

  show(message, type = 'info') {
    snackbarStore.message = message;
    snackbarStore.type = type;
    snackbarStore.visible = true;
  },

  hide() {
    snackbarStore.visible = false;
  },
});
