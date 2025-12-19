// src/shared/data/db/sqlite.js
import log from '@src/shared/infra/log/logService';

/**
 * Lightweight table API on top of react-native-quick-sqlite (optional).
 * - Keeps schema (does NOT drop tables) when clearing.
 * - No ORM magic — just simple helpers.
 */
let conn = null;
let enabled = true;

try {
  // Lazy require so iOS/Android builds without SQLite won’t crash
  const { open } = require('react-native-quick-sqlite');
  conn = open({ name: 'app.db' });
  log.info('[sqliteDB] SQLite connected');
} catch (e) {
  enabled = false;
  log.warn('[sqliteDB] react-native-quick-sqlite not available. Table APIs disabled.', { message: e?.message });
}

/* ------------------------------------------------
 * Internal helpers
 * ------------------------------------------------ */
function ensureSQLite() {
  if (!enabled || !conn) {
    const msg = '[sqliteDB] SQLite is not available.';
    log.error(msg);
    throw new Error(msg);
  }
}

async function run(sql, params = []) {
  ensureSQLite();
  try {
    return await conn.executeAsync(sql, params);
  } catch (e) {
    log.error('[sqliteDB] SQL run failed', { sql, params, message: e?.message });
    throw e;
  }
}

async function all(sql, params = []) {
  const res = await run(sql, params);
  try {
    if (res?.rows?._array) return res.rows._array;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
  } catch (e) {
    log.warn('[sqliteDB] all() result parse failed', { sql, message: e?.message });
    return [];
  }
}

/* ------------------------------------------------
 * Public API
 * ------------------------------------------------ */
export const sqliteDB = {
  /**
   * table(name)
   * - Exposes minimal helpers for a table.
   * - You handle schema creation once in your feature init.
   */
  table(name) {
    const tbl = String(name);

    return {
      /** Run arbitrary SQL for this table’s context */
      run(sql, params) {
        return run(sql, params);
      },

      /** Insert a row (keys -> columns) */
      async insert(row) {
        const keys = Object.keys(row || {});
        if (!keys.length) return;
        const cols = keys.map(k => `"${k}"`).join(', ');
        const qs = keys.map(() => '?').join(', ');
        const vals = keys.map(k => row[k]);
        try {
          await run(`INSERT INTO "${tbl}" (${cols}) VALUES (${qs});`, vals);
          log.debug('[sqliteDB] insert ok', { table: tbl, keys });
        } catch (e) {
          log.error('[sqliteDB] insert failed', { table: tbl, message: e?.message });
          throw e;
        }
      },

      /** Update rows by where clause */
      async update(patch, where = '1=1', params = []) {
        const keys = Object.keys(patch || {});
        if (!keys.length) return;
        const set = keys.map(k => `"${k}" = ?`).join(', ');
        const vals = keys.map(k => patch[k]);
        try {
          await run(`UPDATE "${tbl}" SET ${set} WHERE ${where};`, [...vals, ...params]);
          log.debug('[sqliteDB] update ok', { table: tbl, keys });
        } catch (e) {
          log.error('[sqliteDB] update failed', { table: tbl, message: e?.message });
          throw e;
        }
      },

      /** Delete rows by where clause */
      async remove(where = '1=1', params = []) {
        try {
          await run(`DELETE FROM "${tbl}" WHERE ${where};`, params);
          log.debug('[sqliteDB] remove ok', { table: tbl });
        } catch (e) {
          log.error('[sqliteDB] remove failed', { table: tbl, message: e?.message });
          throw e;
        }
      },

      /** Query convenience */
      async query(where = '1=1', params = [], columns = ['*'], orderBy = '') {
        const cols = Array.isArray(columns) ? columns.join(', ') : String(columns || '*');
        const sql = `SELECT ${cols} FROM "${tbl}" WHERE ${where}${orderBy ? ' ORDER BY ' + orderBy : ''};`;
        try {
          const rows = await all(sql, params);
          log.debug('[sqliteDB] query ok', { table: tbl, count: rows.length });
          return rows;
        } catch (e) {
          log.error('[sqliteDB] query failed', { table: tbl, message: e?.message });
          return [];
        }
      },

      /** Count convenience */
      async count(where = '1=1', params = []) {
        try {
          const rows = await all(`SELECT COUNT(*) as c FROM "${tbl}" WHERE ${where};`, params);
          const count = rows?.[0]?.c ?? 0;
          log.debug('[sqliteDB] count ok', { table: tbl, count });
          return count;
        } catch (e) {
          log.error('[sqliteDB] count failed', { table: tbl, message: e?.message });
          return 0;
        }
      },

      /** Truncate this table only (keep schema) */
      async clear() {
        try {
          await run(`DELETE FROM "${tbl}";`);
          log.info('[sqliteDB] table cleared', { table: tbl });
        } catch (e) {
          log.error('[sqliteDB] clear table failed', { table: tbl, message: e?.message });
        }
      },
    };
  },

  /**
   * Clear **all** application tables (keep schema)
   */
  async clearAll() {
    ensureSQLite();
    try {
      const rows = await all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
          AND name NOT LIKE 'sqlite_%' 
          AND name NOT LIKE 'android_%';
      `);

      for (const r of rows) {
        const name = r?.name;
        if (!name) continue;
        await run(`DELETE FROM "${name}";`);
        log.info('[sqliteDB] table cleared', { table: name });
      }
    } catch (e) {
      log.error('[sqliteDB] clearAll failed', { message: e?.message });
    }
  },
};
