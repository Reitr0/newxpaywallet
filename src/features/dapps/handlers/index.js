// src/features/browser/services/rpcHandlers/index.js
import { coreHandlers } from './coreHandlers';
import { blockHandlers } from './blockHandlers';
import { accountHandlers } from './accountHandlers';
import { signHandlers } from './signHandlers';
import { txHandlers } from './txHandlers';
import { chainHandlers } from './chainHandlers';

export const allHandlers = (ctx) => ({
  ...coreHandlers(ctx),
  ...blockHandlers(ctx),
  ...accountHandlers(ctx),
  ...signHandlers(ctx),
  ...txHandlers(ctx),
  ...chainHandlers(ctx),
});
