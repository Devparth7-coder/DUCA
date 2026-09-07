import crypto from 'node:crypto';
import { config } from './config.js';
import { db } from './db/index.js';
import { now, uid, DAY } from './util.js';

const COOKIE = 'ca_session';

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const t = now();
  await db.run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at, last_seen) VALUES (?,?,?,?,?)',
    [token, userId, t, t + config.sessionTtlDays * DAY, t]
  );
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionTtlDays * 86400}${config.isProd ? '; Secure' : ''}`);
  return token;
}

export async function destroySession(req, res) {
  const tok = parseCookies(req)[COOKIE];
  if (tok) await db.run('DELETE FROM sessions WHERE token = ?', [tok]);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function currentUser(req) {
  const tok = parseCookies(req)[COOKIE];
  if (!tok || tok.length < 20) return null;
  const s = await db.get('SELECT * FROM sessions WHERE token = ?', [tok]);
  if (!s || s.expires_at < now()) return null;
  if (now() - s.last_seen > 30000) db.run('UPDATE sessions SET last_seen = ? WHERE token = ?', [now(), tok]); // fire & forget
  const u = await db.get(
    `SELECT u.id, u.handle, u.name, u.email, u.role, u.rating, u.peak, u.college_id, u.bio, u.created_at, c.name AS college_name
     FROM users u LEFT JOIN colleges c ON c.id = u.college_id WHERE u.id = ?`, [s.user_id]);
  return u || null;
}

export async function activeUserCount(minutes = 10) {
  const rows = await db.all(
    'SELECT DISTINCT user_id FROM sessions WHERE last_seen > ? AND expires_at > ?',
    [now() - minutes * 60000, now()]
  );
  return rows.length;
}
