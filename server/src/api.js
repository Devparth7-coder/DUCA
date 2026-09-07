import { db } from './db/index.js';
import { config } from './config.js';
import { now, uid, hashPassword, verifyPassword, isNonEmptyStr, isSafeHandle, isEmail, rateLimit, clamp, jparse, jstr } from './util.js';
import { createSession, destroySession, currentUser } from './auth.js';
import { LANGS, LANG_KEYS } from './judge/languages.js';
import { systemStatus, buildStandings, computeContestRatings, checkAchievements, contestStatusOf, problemAgg, userSolvedIds, collegeRanking, ACHIEVEMENTS } from './stats.js';
import { broadcast, toUser } from './realtime.js';

/* ---------------- helpers ---------------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => { throw new HttpError(400, m); };
const forbidden = (m = 'forbidden') => { throw new HttpError(403, m); };
const notFound = (m = 'not found') => { throw new HttpError(404, m); };

const pubUser = (u) => u && ({
  id: u.id, handle: u.handle, name: u.name, role: u.role, rating: u.rating, peak: u.peak,
  college_id: u.college_id, college: u.college_name || u.college, created_at: u.created_at,
});

const diffRank = { Easy: 0, Medium: 1, Hard: 2, Insane: 3 };

/* ---------------- router ---------------- */
const routes = [];
const on = (method, path, handler, opts = {}) => routes.push({ method, re: compile(path), keys: keys(path), handler, opts });
function keys(p) { return [...p.matchAll(/:(\w+)/g)].map((m) => m[1]); }
function compile(p) { return new RegExp('^' + p.replace(/:\w+/g, '([^/]+)') + '$'); }

export async function handleApi(req, res, url, app) {
  const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
  if (!route) throw new HttpError(404, 'no such endpoint');

  const params = {};
  const m = url.pathname.match(route.re);
  route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));

  if (route.opts.auth && !req.__user) forbidden('sign in to continue');
  if (route.opts.admin && req.__user?.role !== 'admin') forbidden('admin only');

  // CSRF guard for mutations: require custom header + JSON body
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'codearena') forbidden('missing client header');

  const body = req.method === 'GET' ? {} : await readJson(req);
  const ctx = { app, req, res, url, query: Object.fromEntries(url.searchParams), params, body, user: req.__user };
  return route.handler(ctx);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (d) => { size += d.length; if (size > 2 * 1024 * 1024) { reject(new HttpError(413, 'body too large')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'invalid JSON')); } });
    req.on('error', reject);
  });
}

/* ---------------- meta ---------------- */
on('GET', '/api/time', () => ({ server_time: now() }));
on('GET', '/api/system/status', async (ctx) => ({ ...(await systemStatus(ctx.app?.caps)) }));
on('GET', '/api/achievements', () => ACHIEVEMENTS);
on('GET', '/api/languages', () => LANG_KEYS.map((k) => ({ id: k, label: LANGS[k].label, monaco: LANGS[k].monaco, starter: LANGS[k].starter })));

/* ---------------- auth ---------------- */
on('POST', '/api/auth/register', async (ctx) => {
  const { handle, name, email, password, college_id } = ctx.body;
  if (!isSafeHandle(handle)) bad('handle must be 2–20 chars: letters, digits, . _ -');
  if (!isNonEmptyStr(name, 60)) bad('name required');
  if (!isEmail(email)) bad('valid email required');
  if (typeof password !== 'string' || password.length < 8) bad('password must be at least 8 characters');
  const taken = await db.get('SELECT id FROM users WHERE handle = ? OR email = ?', [handle.toLowerCase(), email.toLowerCase()]);
  if (taken) bad('handle or email already registered');

  let college = null;
  if (college_id) college = await db.get('SELECT * FROM colleges WHERE id = ?', [college_id]);

  const id = uid('u');
  await db.run(
    `INSERT INTO users (id, handle, email, name, pass_hash, college_id, role, created_at, rating, peak)
     VALUES (?,?,?,?,?,?,'user',?,1500,1500)`,
    [id, handle.toLowerCase(), email.toLowerCase(), name.trim(), hashPassword(password), college?.id ?? null, now()]);
  await createSession(ctx.res, id);
  return { ok: true, user: pubUser(await db.get('SELECT * FROM users WHERE id = ?', [id])) };
});

on('POST', '/api/auth/login', async (ctx) => {
  const { login, password } = ctx.body;
  if (!isNonEmptyStr(login, 120) || typeof password !== 'string') bad('login and password required');
  if (!rateLimit('login:' + (ctx.req.socket.remoteAddress || '?'), 8, 0.2)) throw new HttpError(429, 'too many attempts — wait a minute');
  const u = await db.get('SELECT * FROM users WHERE handle = ? OR email = ?', [String(login).toLowerCase(), String(login).toLowerCase()]);
  if (!u || !verifyPassword(password, u.pass_hash)) throw new HttpError(401, 'invalid credentials');
  await createSession(ctx.res, u.id);
  return { ok: true, user: pubUser(u) };
});

on('POST', '/api/auth/logout', async (ctx) => { await destroySession(ctx.req, ctx.res); return { ok: true }; });
on('GET', '/api/auth/me', async (ctx) => (ctx.user ? { user: pubUser(ctx.user) } : { user: null }));

on('POST', '/api/auth/college', async (ctx) => {
  if (!ctx.user) forbidden();
  const name = String(ctx.body.name || '').trim();
  if (!isNonEmptyStr(name, 120)) bad('college name required');
  let c = await db.get('SELECT * FROM colleges WHERE lower(name) = ?', [name.toLowerCase()]);
  if (!c) {
    const id = uid('c'); const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'COL';
    await db.run('INSERT INTO colleges (id, name, code, city) VALUES (?,?,?,?)', [id, name, code, ctx.body.city || '']);
    c = { id, name, code };
  }
  await db.run('UPDATE users SET college_id = ? WHERE id = ?', [c.id, ctx.user.id]);
  return { ok: true, college: c };
});

/* ---------------- colleges ---------------- */
on('GET', '/api/colleges', async () =>
  db.all(`SELECT c.*, (SELECT COUNT(*) FROM users u WHERE u.college_id = c.id) AS members
          FROM colleges c ORDER BY c.name`, []));

on('GET', '/api/leaderboard/colleges', async () => ({ rows: await collegeRanking() }));

/* ---------------- problems ---------------- */
on('GET', '/api/problems', async (ctx) => {
  const { search, diff, tag, sort } = ctx.query;
  let rows = await db.all(`SELECT id, title, difficulty, tags, created_at FROM problems ORDER BY id`, []);
  const agg = await problemAgg();
  if (search) { const q = search.toLowerCase(); rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.id.includes(q)); }
  if (diff) rows = rows.filter((r) => diff.split(',').includes(r.difficulty));
  if (tag) rows = rows.filter((r) => jparse(r.tags, []).includes(tag));
  const solved = ctx.user ? await userSolvedIds(ctx.user.id) : new Set();
  let out = rows.map((r) => ({ ...r, tags: jparse(r.tags, []), solved: solved.has(r.id), stats: agg(r.id) }));
  if (sort === 'difficulty') out.sort((a, b) => diffRank[a.difficulty] - diffRank[b.difficulty]);
  return { items: out, total: out.length };
});

on('GET', '/api/problems/:id', async (ctx) => {
  const p = await db.get('SELECT * FROM problems WHERE id = ?', [ctx.params.id]);
  if (!p) notFound('problem not found');
  const agg = await problemAgg([p.id]);
  const mine = ctx.user
    ? await db.all('SELECT id, lang, status, time_ms, created_at FROM submissions WHERE user_id = ? AND problem_id = ? ORDER BY created_at DESC LIMIT 12', [ctx.user.id, p.id])
    : [];
  const solvedSet = ctx.user ? await userSolvedIds(ctx.user.id) : new Set();
  return {
    problem: {
      id: p.id, title: p.title, difficulty: p.difficulty, tags: jparse(p.tags, []),
      statement: p.statement, input_format: p.input_format, output_format: p.output_format,
      constraints: p.constraints, examples: jparse(p.examples, []), notes: p.notes,
      tl_ms: p.tl_ms, ml_mb: p.ml_mb, starter: jparse(p.starter, {}),
    },
    stats: agg(p.id),
    solved: solvedSet.has(p.id),
    attempts: (await db.get('SELECT COUNT(*) AS c FROM submissions WHERE user_id = ? AND problem_id = ?', [ctx.user?.id || '-', p.id]))?.c || 0,
    recent: mine,
  };
});

/* ---------------- judging ---------------- */
async function loadProblemForJudge(id) {
  const p = await db.get('SELECT * FROM problems WHERE id = ?', [id]);
  if (!p) notFound('problem not found');
  return p;
}

on('POST', '/api/judge/run', async (ctx) => {
  if (!ctx.user) forbidden('sign in to run code');
  const { problem_id, language, code } = ctx.body;
  validateSubmission({ problem_id, language, code });
  const p = await loadProblemForJudge(problem_id);
  const job = { kind: 'run', user_id: ctx.user.id, problem: p, langKey: language, code, samplesOnly: true };
  const result = await ctx.app.judgeNow(job);
  return result;
}, { auth: true });

on('POST', '/api/judge/submit', async (ctx) => {
  if (!ctx.user) forbidden('sign in to submit');
  const ip = ctx.req.socket.remoteAddress || '?';
  if (!rateLimit('sub:' + ip, 12, 0.5)) throw new HttpError(429, 'judge rate limit — slow down');
  const { problem_id, language, code, contest_id } = ctx.body;
  validateSubmission({ problem_id, language, code });
  const p = await loadProblemForJudge(problem_id);

  let cid = null;
  if (contest_id) {
    const c = await db.get('SELECT * FROM contests WHERE id = ?', [contest_id]);
    if (!c) notFound('contest not found');
    if (contestStatusOf(c) !== 'live') bad('contest is not live');
    const inContest = await db.get('SELECT 1 AS x FROM contest_problems WHERE contest_id = ? AND problem_id = ?', [contest_id, problem_id]);
    if (!inContest) bad('problem is not part of this contest');
    cid = contest_id;
    try { await db.run('INSERT INTO contest_registrations (contest_id, user_id, created_at) VALUES (?,?,?)', [contest_id, ctx.user.id, now()]); } catch { /* already registered */ }
  }

  const id = uid('s');
  await db.run(
    `INSERT INTO submissions (id, user_id, problem_id, contest_id, lang, code, status, created_at)
     VALUES (?,?,?,?,?,?,'queued',?)`,
    [id, ctx.user.id, problem_id, cid, language, code, now()]);
  ctx.app.enqueue(id);
  broadcast('submission_queued', { id, user: ctx.user.handle, problem: problem_id, contest: cid, lang: language });
  return { id, status: 'queued' };
}, { auth: true });

function validateSubmission({ problem_id, language, code }) {
  if (!isNonEmptyStr(problem_id, 80)) bad('problem_id required');
  if (!LANG_KEYS.includes(language)) bad('unsupported language');
  if (typeof code !== 'string' || code.length === 0) bad('empty submission');
  if (Buffer.byteLength(code) > config.judge.maxCodeBytes) bad('source exceeds ' + Math.floor(config.judge.maxCodeBytes / 1024) + 'KB');
}

on('GET', '/api/submissions/:id', async (ctx) => {
  const s = await db.get('SELECT * FROM submissions WHERE id = ?', [ctx.params.id]);
  if (!s) notFound('submission not found');
  const own = ctx.user?.id === s.user_id || ctx.user?.role === 'admin';
  return {
    submission: {
      id: s.id, user_id: s.user_id, problem_id: s.problem_id, contest_id: s.contest_id,
      lang: s.lang, status: s.status, passed: s.passed, total: s.total,
      time_ms: s.time_ms, mem_kb: s.mem_kb, created_at: s.created_at, judged_at: s.judged_at,
      code: own ? s.code : undefined, err: own ? s.err : redact(s.err),
      details: own ? jparse(s.details, []) : [],
      user: (await db.get('SELECT handle FROM users WHERE id = ?', [s.user_id]))?.handle,
    },
  };
});

const redact = (s) => (s ? 'error details hidden' : '');

on('GET', '/api/submissions', async (ctx) => {
  const lim = clamp(Number(ctx.query.limit) || 50, 1, 200);
  const conds = []; const params = [];
  if (ctx.query.user) { conds.push('s.user_id = ?'); params.push(ctx.query.user); }
  if (ctx.query.problem) { conds.push('s.problem_id = ?'); params.push(ctx.query.problem); }
  if (ctx.query.contest) { conds.push('s.contest_id = ?'); params.push(ctx.query.contest); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = await db.all(
    `SELECT s.id, s.problem_id, s.contest_id, s.lang, s.status, s.passed, s.total, s.time_ms, s.created_at,
            u.handle, p.title AS problem_title, p.difficulty
     FROM submissions s JOIN users u ON u.id = s.user_id JOIN problems p ON p.id = s.problem_id
     ${where} ORDER BY s.created_at DESC LIMIT ${lim}`, params);
  return { items: rows };
});

/* ---------------- contests ---------------- */
const contestView = (c, extra = {}) => ({
  id: c.id, title: c.title, subtitle: c.subtitle, description: c.description, rules: c.rules,
  start_at: c.start_at, end_at: c.end_at, duration_ms: c.end_at - c.start_at,
  penalty_min: c.penalty_min, rated: c.rated === 1, status: contestStatusOf(c), ...extra,
});

on('GET', '/api/contests', async (ctx) => {
  const rows = await db.all('SELECT * FROM contests ORDER BY start_at DESC', []);
  const out = [];
  for (const c of rows) {
    const reg = await db.get('SELECT COUNT(*) AS c FROM contest_registrations WHERE contest_id = ?', [c.id]);
    const np = await db.get('SELECT COUNT(*) AS c FROM contest_problems WHERE contest_id = ?', [c.id]);
    out.push(contestView(c, { registered: reg?.c || 0, problems: np?.c || 0, my_registered: false }));
  }
  if (ctx.user) {
    const mine = new Set((await db.all('SELECT contest_id FROM contest_registrations WHERE user_id = ?', [ctx.user.id])).map((r) => r.contest_id));
    out.forEach((c) => (c.my_registered = mine.has(c.id)));
  }
  return { items: out };
});

on('GET', '/api/contests/:id', async (ctx) => {
  const c = await db.get('SELECT * FROM contests WHERE id = ?', [ctx.params.id]);
  if (!c) notFound('contest not found');
  const standing = await buildStandings(c, ctx.user?.id);
  const me = ctx.user ? standing.rows.find((r) => r.user_id === ctx.user.id) : null;
  const registered = ctx.user
    ? !!(await db.get('SELECT 1 AS x FROM contest_registrations WHERE contest_id = ? AND user_id = ?', [c.id, ctx.user.id]))
    : false;
  const scored = await db.get('SELECT COUNT(*) AS c FROM rating_events WHERE contest_id = ?', [c.id]);
  return {
    contest: contestView(c, { registered: standing.registered, my_registered: registered }),
    problems: standing.problems,
    me: me ? { rank: me.place, solved: me.solved, penalty: me.penalty } : null,
    my_submissions: ctx.user
      ? await db.all(`SELECT s.id, s.problem_id, s.lang, s.status, s.passed, s.total, s.time_ms, s.created_at, cp.label
                      FROM submissions s LEFT JOIN contest_problems cp ON cp.problem_id = s.problem_id AND cp.contest_id = s.contest_id
                      WHERE s.contest_id = ? AND s.user_id = ? ORDER BY s.created_at DESC LIMIT 40`, [c.id, ctx.user.id])
      : [],
    standings: standing.rows.slice(0, 120),
    ratings_published: (scored?.c || 0) > 0,
  };
});

on('POST', '/api/contests/:id/register', async (ctx) => {
  const c = await db.get('SELECT * FROM contests WHERE id = ?', [ctx.params.id]);
  if (!c) notFound('contest not found');
  if (contestStatusOf(c) === 'finished') bad('contest has ended');
  try { await db.run('INSERT INTO contest_registrations (contest_id, user_id, created_at) VALUES (?,?,?)', [c.id, ctx.user.id, now()]); } catch { /* already registered */ }
  return { ok: true, already: true };
}, { auth: true });

on('GET', '/api/contests/:id/standings', async (ctx) => {
  const c = await db.get('SELECT * FROM contests WHERE id = ?', [ctx.params.id]);
  if (!c) notFound('contest not found');
  const s = await buildStandings(c);
  const rating = await db.all(
    `SELECT r.user_id, r.delta, r.rank, u.handle FROM rating_events r JOIN users u ON u.id = r.user_id WHERE r.contest_id = ?`, [c.id]);
  return { status: contestStatusOf(c), rows: s.rows.slice(0, 300), ratings: rating, end_at: c.end_at };
});

/* ---------------- users / profiles ---------------- */
on('GET', '/api/leaderboard', async (ctx) => {
  const q = ctx.query.search;
  const lim = clamp(Number(ctx.query.limit) || 100, 1, 250);
  const rows = await db.all(
    `SELECT u.id, u.handle, u.name, u.rating, u.peak, c.name AS college, c.code AS college_code
     FROM users u LEFT JOIN colleges c ON c.id = u.college_id
     WHERE u.rating > 0 ORDER BY u.rating DESC, u.handle ASC LIMIT ${lim}`, []);
  let out = rows;
  if (q) { const s = q.toLowerCase(); out = rows.filter((r) => r.handle.toLowerCase().includes(s) || String(r.name).toLowerCase().includes(s)); }
  const withSolved = [];
  for (const r of out) {
    const s = await db.get("SELECT COUNT(DISTINCT problem_id) AS c FROM submissions WHERE user_id=? AND status='accepted'", [r.id]);
    withSolved.push({ ...r, solved: s?.c || 0 });
  }
  return { items: withSolved };
});

on('GET', '/api/users/:handle', async (ctx) => {
  const u = await db.get(
    `SELECT u.id, u.handle, u.name, u.role, u.bio, u.rating, u.peak, u.created_at, c.name AS college
     FROM users u LEFT JOIN colleges c ON c.id = u.college_id WHERE lower(u.handle) = ?`, [ctx.params.handle.toLowerCase()]);
  if (!u) notFound('user not found');
  const id = u.id;
  const [solved, recent, ratingHist, achs, act, perDiff, perTag] = await Promise.all([
    db.all(`SELECT p.id, p.title, p.difficulty FROM submissions s JOIN problems p ON p.id = s.problem_id
            WHERE s.user_id = ? AND s.status='accepted' GROUP BY p.id`, [id]),
    db.all(`SELECT s.id, s.problem_id, p.title, p.difficulty, s.lang, s.status, s.created_at FROM submissions s
            JOIN problems p ON p.id = s.problem_id WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 15`, [id]),
    db.all('SELECT contest_id, old_rating, new_rating, delta, rank, computed_at FROM rating_events WHERE user_id = ? ORDER BY computed_at ASC', [id]),
    db.all(`SELECT a.id, a.name, a.description, ua.earned_at FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = ? ORDER BY ua.earned_at DESC`, [id]),
    db.all(`SELECT (created_at / 86400000) AS day, COUNT(*) AS c FROM submissions WHERE user_id = ? GROUP BY day`, [id]),
    db.all(`SELECT p.difficulty, COUNT(*) AS tries, SUM(CASE WHEN s.status='accepted' THEN 1 ELSE 0 END) AS acc
            FROM submissions s JOIN problems p ON p.id = s.problem_id WHERE s.user_id = ? GROUP BY p.difficulty`, [id]),
    db.all(`SELECT s.problem_id FROM submissions s WHERE s.user_id = ? AND s.status='accepted' GROUP BY s.problem_id`, [id]),
  ]);
  const probs = await db.all('SELECT id, tags, difficulty FROM problems', []);
  const byId = new Map(probs.map((p) => [p.id, p]));
  const tagAgg = new Map();
  for (const row of perTag) {
    const p = byId.get(row.problem_id); if (!p) continue;
    for (const t of jparse(p.tags, [])) {
      const cur = tagAgg.get(t) || { tag: t, solved: 0 };
      cur.solved++; tagAgg.set(t, cur);
    }
  }
  return {
    user: u,
    solved: solved.sort((a, b) => diffRank[a.difficulty] - diffRank[b.difficulty]),
    recent, rating_history: ratingHist, achievements: achs,
    activity: act.map((r) => ({ day: r.day, c: r.c })),
    by_difficulty: perDiff, tags: [...tagAgg.values()].sort((a, b) => b.solved - a.solved),
  };
});

on('GET', '/api/me/dashboard', async (ctx) => {
  const id = ctx.user.id;
  const [subs, contests, achs, solvedCount, pending] = await Promise.all([
    db.all(`SELECT s.id, s.problem_id, p.title, p.difficulty, s.contest_id, s.lang, s.status, s.time_ms, s.created_at
            FROM submissions s JOIN problems p ON p.id = s.problem_id WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 25`, [id]),
    db.all('SELECT * FROM contests ORDER BY start_at DESC LIMIT 8', []),
    db.all(`SELECT a.id, a.name, a.description, ua.earned_at FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = ?`, [id]),
    db.get("SELECT COUNT(DISTINCT problem_id) AS c FROM submissions WHERE user_id=? AND status='accepted'", [id]),
    db.get("SELECT COUNT(*) AS c FROM submissions WHERE user_id=? AND status IN ('queued','judging')", [id]),
  ]);
  const myRegs = new Set((await db.all('SELECT contest_id FROM contest_registrations WHERE user_id = ?', [id])).map((r) => r.contest_id));
  return {
    user: pubUser(ctx.user),
    accepted_solved: solvedCount?.c || 0,
    submissions: subs,
    pending: pending?.c || 0,
    achievements: achs,
    contests: contests.map((c) => contestView(c, { my_registered: myRegs.has(c.id) })),
  };
}, { auth: true });

/* ---------------- admin ---------------- */
on('GET', '/api/admin/context', async (ctx) => ({
  ok: true, queue: ctx.app.queueInfo(), caps: ctx.app.caps,
  counts: await db.get('SELECT (SELECT COUNT(*) FROM problems) AS problems, (SELECT COUNT(*) FROM contests) AS contests, (SELECT COUNT(*) FROM users) AS users', []),
}), { admin: true });

on('POST', '/api/admin/contests', async (ctx) => {
  const b = ctx.body;
  if (!isNonEmptyStr(b.id, 60) || !/^[a-z0-9-]{3,60}$/.test(b.id)) bad('contest id: slug-like (a-z0-9-)');
  if (!isNonEmptyStr(b.title, 140)) bad('title required');
  if (!Number.isFinite(b.start_at) || !Number.isFinite(b.end_at) || b.end_at <= b.start_at) bad('start_at/end_at epoch ms required');
  if ((await db.get('SELECT id FROM contests WHERE id = ?', [b.id]))) bad('contest id exists');
  const id = b.id;
  await db.run(
    `INSERT INTO contests (id, title, subtitle, description, rules, start_at, end_at, penalty_min, rated, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, b.title.trim(), String(b.subtitle || ''), String(b.description || ''), String(b.rules || ''),
      b.start_at, b.end_at, clamp(Number(b.penalty_min) || 20, 1, 120), b.rated === false ? 0 : 1, ctx.user.id, now()]);
  let ord = 0;
  for (const pid of (b.problems || []).map(String)) {
    const p = await db.get('SELECT id FROM problems WHERE id = ?', [pid]);
    if (!p) bad(`unknown problem ${pid}`);
    await db.run('INSERT INTO contest_problems (contest_id, problem_id, ord, label) VALUES (?,?,?,?)',
      [id, pid, ord, String.fromCharCode(65 + (ord % 26))]);
    ord++;
  }
  broadcast('contest_status', { id });
  return { ok: true };
}, { admin: true });

on('POST', '/api/admin/problems', async (ctx) => {
  const b = ctx.body;
  if (!isNonEmptyStr(b.id, 60) || !/^[a-z0-9-]{3,60}$/.test(b.id)) bad('problem id: slug-like');
  if (!isNonEmptyStr(b.title, 140)) bad('title required');
  if (!['Easy', 'Medium', 'Hard', 'Insane'].includes(b.difficulty)) bad('bad difficulty');
  if (!Array.isArray(b.tests) || !b.tests.length) bad('tests: [{input, output, hidden}] required');
  if ((await db.get('SELECT id FROM problems WHERE id = ?', [b.id]))) bad('problem id exists');
  await db.run(
    `INSERT INTO problems (id, title, difficulty, tags, statement, input_format, output_format, constraints, examples, notes, tests, tl_ms, ml_mb, starter, author_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.id, b.title, b.difficulty, jstr(b.tags || []), String(b.statement || ''), String(b.input_format || ''),
      String(b.output_format || ''), String(b.constraints || ''), jstr(b.examples || []), String(b.notes || ''),
      jstr(b.tests), clamp(Number(b.tl_ms) || 2000, 250, 10000), clamp(Number(b.ml_mb) || 256, 64, 1024),
      jstr({}), ctx.user.id, now()]);
  return { ok: true };
}, { admin: true });

on('POST', '/api/admin/rerate/:id', async (ctx) => {
  const r = await computeContestRatings(ctx.params.id);
  return { ok: true, result: r };
}, { admin: true });

export { HttpError };
