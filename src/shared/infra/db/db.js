// src/shared/data/db/index.js
import log from '@src/shared/infra/log/logService';
import { sqliteDB } from '@src/shared/infra/db/providers/sqlite';
import { mmkvDB } from '@src/shared/infra/db/providers/mmkv';

/**
 * Central entry point:
 * - Document (KV) storage via MMKV
 * - Relational (table) storage via SQLite (optional)
 * - One-shot clearAll() to wipe user data safely
 */
export const db = {
  /** Single-document store (MMKV) */
  doc: mmkvDB.doc,

  /** Table access (SQLite) */
  table: sqliteDB.table,

  /**
   * Clear ALL local data:
   * - MMKV: all keys in 'app-db' namespace
   * - SQLite: DELETE FROM each user table (schema preserved)
   */
  async clearAll() {
    log.info('[db] Clearing all data (MMKV + SQLite)…');

    try {
      mmkvDB.clearAll();
      log.info('[db] MMKV cleared');
    } catch (e) {
      log.warn('[db] MMKV clear failed', { message: e?.message });
    }

    try {
      await sqliteDB.clearAll();
      log.info('[db] SQLite cleared');
    } catch (e) {
      log.warn('[db] SQLite clear failed', { message: e?.message });
    }

    log.info('[db] All data cleared.');
  },
};

export default db;
