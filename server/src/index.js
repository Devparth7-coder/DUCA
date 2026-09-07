import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { db, initDb } from './db/index.js';
import { now, jparse, jstr, uid } from './util.js';
import { currentUser } from './auth.js';
import { handleApi, HttpError } from './api.js';
import { addClient, broadcast, presence } from './realtime.js';
import { judgeRun, probeCapabilities, cleanupWorkdirs } from './judge/runner.js';
import { JudgeQueue } from './judge/queue.js';
import { contestStatusOf, computeContestRatings, checkAchievements, bindQueue } from './stats.js';

const WEB = path.join(ROOT, 'web', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.map': 'application/json', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

function securityHeaders(res, isHtml) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  // NOTE: X-Frame-Options intentionally omitted — Render preview + embeddable leaderboard cards.
  if (isHtml) {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'");
  }
}

async function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(WEB, pathname));
  if (!file.startsWith(WEB)) { res.writeHead(403).end(); return true; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (pathname.startsWith('/api/')) return false;
    file = path.join(WEB, 'index.html'); // SPA fallback
    if (!fs.existsSync(file)) return false;
  }
  const ext = path.extname(file);
  const isHtml = ext === '.html';
  securityHeaders(res, isHtml);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': pathname.startsWith('/assets/') && !isHtml ? 'public, max-age=31536000, immutable' : (isHtml ? 'no-cache' : 'public, max-age=3600'),
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

/* ------------------------------------------------------------------ */
let queue, caps, server;
let lastStatus = new Map();

async function judgeSubmission(subId) {
  const s = await db.get('SELECT * FROM submissions WHERE id = ?', [subId]);
  if (!s || (s.status !== 'queued' && s.status !== 'judging')) return;
  await db.run("UPDATE submissions SET status='judging' WHERE id = ?", [subId]);
  broadcast('submission_status', { id: subId, status: 'judging' });

  let outcome;
  try {
    const p = await db.get('SELECT * FROM problems WHERE id = ?', [s.problem_id]);
    if (!p) throw new Error('problem vanished');
    outcome = await judgeRun({ langKey: s.lang, code: s.code, tests: jparse(p.tests, []), tlMs: p.tl_ms, mlMb: p.ml_mb });
  } catch (e) {
    outcome = { status: 'internal_error', passed: 0, total: 0, time_ms: 0, mem_kb: 0, err: String(e?.message || e), details: [] };
  }

  await db.run(
    `UPDATE submissions SET status=?, passed=?, total=?, time_ms=?, mem_kb=?, err=?, details=?, judged_at=? WHERE id=?`,
    [outcome.status, outcome.passed, outcome.total, outcome.time_ms || 0, Math.max(0, outcome.mem_kb - 18000), outcome.err || '',
      jstr(outcome.details || []), now(), subId]);

  const meta = { id: subId, status: outcome.status, user: s.user_id, handle: null, problem: s.problem_id, contest: s.contest_id, time_ms: outcome.time_ms, passed: outcome.passed, total: outcome.total };
  const u = await db.get('SELECT handle FROM users WHERE id = ?', [s.user_id]);
  meta.handle = u?.handle || '?';
  broadcast('submission', meta);

  const newAch = await checkAchievements(s.user_id);
  if (newAch.length) toUser2(s.user_id, { achievements: newAch });
  if (s.contest_id && outcome.status === 'accepted') broadcast('standings_changed', { contest: s.contest_id });
}

function toUser2(userId, payload) {
  broadcast('personal', { user: userId, ...payload });
}

async function runTrial(job) {
  const p = job.problem;
  return judgeRun({ langKey: job.langKey, code: job.code, tests: jparse(p.tests, []).slice(0, 8), tlMs: p.tl_ms, mlMb: p.ml_mb, samplesOnly: true });
}

async function requeuePending() {
  const rows = await db.all("SELECT id FROM submissions WHERE status IN ('queued','judging') ORDER BY created_at ASC LIMIT 500", []);
  for (const r of rows) queue.push(r.id);
}

async function tickContests() {
  try {
    const rows = await db.all('SELECT * FROM contests', []);
    for (const c of rows) {
      const st = contestStatusOf(c);
      const prev = lastStatus.get(c.id);
      if (prev !== st) {
        lastStatus.set(c.id, st);
        broadcast('contest_status', { id: c.id, status: st, start_at: c.start_at, end_at: c.end_at });
        if (st === 'finished') {
          const r = await computeContestRatings(c.id).catch(() => null);
          if (r?.events?.length) broadcast('ratings_published', { contest: c.id, rated: r.rated });
        }
      }
    }
  } catch (e) { console.error('[contests] tick failed', e); }
}

const app = {
  get caps() { return caps; },
  enqueue: (id) => queue.push(id),
  queueInfo: () => ({ depth: queue.depth }),
  judgeNow: (job) => runTrial(job),
};

async function main() {
  await initDb();
  caps = await probeCapabilities();

  const userCount = (await db.get('SELECT COUNT(*) AS c FROM users', []))?.c || 0;
  if (config.autoseed && userCount === 0) {
    console.log('[arena] empty database — seeding demo arena (this runs real judged submissions)…');
    const { seed } = await import('./db/seed.js');
    await seed();
  }

  queue = new JudgeQueue(config.judge.concurrency, judgeSubmission);
  bindQueue(queue);
  await requeuePending();
  lastStatus = new Map((await db.all('SELECT * FROM contests', [])).map((c) => [c.id, contestStatusOf(c)]));

  const contestTimer = setInterval(tickContests, 10000);
  const gcTimer = setInterval(() => cleanupWorkdirs(), 600000);

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname === '/api/stream') {
        const user = await currentUser(req);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || config.origin || '*',
        });
        const rm = addClient(res, user);
        res.write(`event: hello\ndata: ${JSON.stringify({ server_time: now(), online: presence().online_users })}\n\n`);
        req.on('close', rm);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        req.__user = await currentUser(req);
        const out = await handleApi(req, res, url, app);
        securityHeaders(res, false);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(out ?? {}));
        return;
      }
      const ok = await serveStatic(req, res, url.pathname);
      if (!ok) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); }
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error('[api]', e);
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: status === 500 ? 'internal error' : e.message }));
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(`[arena] CodeArena online → http://${config.host}:${config.port}`);
    console.log(`[arena] judge slots: ${config.judge.concurrency} · languages: ${Object.keys(caps.languages).filter((k) => caps.languages[k].ok).join(', ')}`);
  });

  const shutdown = () => { console.log('[arena] shutting down'); clearInterval(contestTimer); clearInterval(gcTimer); server?.close(); process.exit(0); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

main().catch((e) => { console.error('[arena] fatal', e); process.exit(1); });
