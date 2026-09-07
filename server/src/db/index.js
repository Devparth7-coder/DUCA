import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from '../config.js';

/**
 * Thin portable data layer. Two drivers, one SQL dialect (SQLite-compatible):
 *   - better-sqlite3 (local dev / single box)
 *   - node-postgres  (Render Postgres via DATABASE_URL)
 * Placeholders are always `?`. Ids are TEXT. Timestamps are epoch-millis INTEGERs.
 */
export let db = null;

export async function initDb() {
  db = config.databaseUrl ? await pgDriver(config.databaseUrl) : await sqliteDriver();
  await applySchema();
  return db;
}

function normalize(params) {
  return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p));
}

async function sqliteDriver() {
  const Database = (await import('better-sqlite3')).default;
  const file = path.join(config.dataDir, 'codearena.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sql = new Database(file);
  sql.pragma('journal_mode = WAL');
  sql.pragma('synchronous = NORMAL');
  sql.pragma('foreign_keys = ON');
  return {
    kind: 'sqlite',
    file,
    all: (q, p = []) => sql.prepare(q).all(...normalize(p)),
    get: (q, p = []) => sql.prepare(q).get(...normalize(p)) ?? null,
    run: (q, p = []) => { const r = sql.prepare(q).run(...normalize(p)); return { changes: r.changes }; },
    exec: (text) => { sql.exec(text); },
  };
}

async function pgDriver(url) {
  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: url, max: 10, ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false } });
  const conv = (q) => { let i = 0; return q.replace(/\?/g, () => `$${++i}`); };
  return {
    kind: 'postgres',
    all: async (q, p = []) => (await pool.query(conv(q), normalize(p))).rows.map(rowToCamelSafe),
    get: async (q, p = []) => { const r = await pool.query(conv(q), normalize(p)); return r.rows[0] ? rowToCamelSafe(r.rows[0]) : null; },
    run: async (q, p = []) => ({ changes: (await pool.query(conv(q), normalize(p))).rowCount }),
    exec: async (text) => { await pool.query(text); },
  };
}
const rowToCamelSafe = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' && /^\d+$/.test(v) && false ? v : v;
  return out;
};

async function applySchema() {
  const schema = fs.readFileSync(path.join(ROOT, 'server/src/db/schema.sql'), 'utf8');
  // split on ';' at line ends so both drivers can execute
  const stmts = schema.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await db.run(s, []);
}

export const isPg = () => db.kind === 'postgres';
