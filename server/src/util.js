import crypto from 'node:crypto';

export const uid = (prefix = '') =>
  prefix + crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, '') + Date.now().toString(36).slice(-5);

export const now = () => Date.now();
export const DAY = 86400000, HOUR = 3600000, MIN = 60000, SEC = 1000;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const num = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

export function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// scrypt password hashing (no native deps)
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [, salt, hash] = String(stored).split(':');
    const got = crypto.scryptSync(pw, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(got, 'hex'));
  } catch { return false; }
}

export const jparse = (v, d) => { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? d); } catch { return d; } };
export const jstr = (v) => JSON.stringify(v ?? null);

export const isNonEmptyStr = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const isSafeHandle = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9._-]{1,19}$/i.test(v);
export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length < 254;

// minimal token bucket limiter keyed by ip
const buckets = new Map();
export function rateLimit(key, capacity, refillPerSec) {
  const t = now();
  let b = buckets.get(key);
  if (!b) { b = { tok: capacity, ts: t }; buckets.set(key, b); }
  b.tok = Math.min(capacity, b.tok + ((t - b.ts) / 1000) * refillPerSec);
  b.ts = t;
  if (b.tok >= 1) { b.tok -= 1; return true; }
  return false;
}
setInterval(() => { const t = now(); for (const [k, b] of buckets) if (t - b.ts > 600000) buckets.delete(k); }, 120000).unref();
