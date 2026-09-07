import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// tiny .env loader (no dependency) — loads /<repo>/.env if present
(() => {
  for (const p of [path.join(ROOT, '.env'), path.join(ROOT, 'server/.env')]) {
    try {
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* optional */ }
  }
})();

const n = (v, d) => (v !== undefined && v !== '' ? Number(v) : d);

export const config = {
  port: n(process.env.PORT, 8080),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  dataDir: path.resolve(ROOT, process.env.DATA_DIR || './data'),
  databaseUrl: process.env.DATABASE_URL || '',
  autoseed: process.env.AUTOSEED !== '0',
  judge: {
    concurrency: n(process.env.JUDGE_CONCURRENCY, 2),
    maxCodeBytes: n(process.env.JUDGE_MAX_CODE_BYTES, 65536),
    maxOutputBytes: 262144,
    compileMs: 15000,
  },
  sessionTtlDays: n(process.env.SESSION_TTL_DAYS, 30),
};

fs.mkdirSync(config.dataDir, { recursive: true });
