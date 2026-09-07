import { db } from './db/index.js';
import { config } from './config.js';
import { now, clamp, uid, jparse } from './util.js';
import { presence } from './realtime.js';

export const contestStatusOf = (c, t = now()) => (t < c.start_at ? 'upcoming' : t < c.end_at ? 'live' : 'finished');

const DIFF_EMOJI = { Easy: 1, Medium: 2, Hard: 3, Insane: 4 };

/** ---------- problem aggregates (computed, never fabricated) ---------- */
export async function problemAgg(problemIds = null) {
  const where = problemIds?.length ? `AND s.problem_id IN (${problemIds.map(() => '?').join(',')})` : '';
  const p = problemIds?.length ? problemIds : [];
  const rows = await db.all(
    `SELECT s.problem_id,
            COUNT(*) AS attempts,
            SUM(CASE WHEN s.status='accepted' THEN 1 ELSE 0 END) AS accepted,
            COUNT(DISTINCT s.user_id) AS solvers
     FROM submissions s WHERE s.status != 'queued' AND s.status != 'judging' ${where}
     GROUP BY s.problem_id`, p);
  const map = new Map(rows.map((r) => [r.problem_id, r]));
  return (id) => map.get(id) || { attempts: 0, accepted: 0, solvers: 0 };
}

export async function userSolvedIds(userId) {
  const rows = await db.all("SELECT DISTINCT problem_id FROM submissions WHERE user_id = ? AND status = 'accepted'", [userId]);
  return new Set(rows.map((r) => r.problem_id));
}

export async function userRunCounts(userId) {
  return db.all(
    'SELECT problem_id, COUNT(*) AS tries, MAX(CASE WHEN status = \'accepted\' THEN 1 ELSE 0 END) AS solved, MAX(created_at) AS last_at, MAX(lang) AS lang FROM submissions WHERE user_id = ? GROUP BY problem_id',
    [userId]);
}

/** ---------- contest standings (ICPC-style: solves, then penalty) ---------- */
export async function buildStandings(contest, viewerId = null) {
  const contestId = contest.id;
  const probs = await db.all(
    `SELECT cp.label, cp.ord, p.id, p.title, p.difficulty FROM contest_problems cp
     JOIN problems p ON p.id = cp.problem_id WHERE cp.contest_id = ? ORDER BY cp.ord`, [contestId]);

  const [regs, subs] = await Promise.all([
    db.all('SELECT user_id FROM contest_registrations WHERE contest_id = ?', [contestId]),
    db.all(
      `SELECT s.id, s.user_id, s.problem_id, s.status, s.created_at, s.lang FROM submissions s
       WHERE s.contest_id = ? AND s.status != 'queued' AND s.status != 'judging' ORDER BY s.created_at ASC`,
      [contestId]),
  ]);

  const partIds = new Set(regs.map((r) => r.user_id));
  subs.forEach((s) => partIds.add(s.user_id));

  const perUser = new Map();
  const ensure = (uid_) => {
    if (!perUser.has(uid_)) perUser.set(uid_, { solved: 0, penalty: 0, lastAc: 0, cells: new Map() });
    return perUser.get(uid_);
  };
  for (const s of subs) {
    const u = ensure(s.user_id);
    if (!u.cells.has(s.problem_id)) u.cells.set(s.problem_id, { fails: 0, ac: 0, acMin: 0 });
    const cell = u.cells.get(s.problem_id);
    if (cell.ac) continue;
    if (s.status === 'accepted') {
      cell.ac = 1;
      cell.acMin = Math.floor((s.created_at - contest.start_at) / 60000);
      u.solved++; u.penalty += cell.acMin + cell.fails * (contest.penalty_min || 20);
      u.lastAc = Math.max(u.lastAc, s.created_at);
    } else cell.fails++;
  }

  const uids = [...partIds];
  const users = uids.length
    ? await db.all(
      `SELECT u.id, u.handle, u.name, u.rating, c.name AS college, c.code AS college_code, c.id AS college_id
       FROM users u LEFT JOIN colleges c ON c.id = u.college_id WHERE u.id IN (${uids.map(() => '?').join(',')})`, uids)
    : [];

  const byId = new Map(users.map((u) => [u.id, u]));
  const rows = [];
  for (const id of uids) {
    const u = byId.get(id); if (!u) continue;
    const st = perUser.get(id) || { solved: 0, penalty: 0, lastAc: 0, cells: new Map() };
    rows.push({
      user_id: id, handle: u.handle, name: u.name, rating: u.rating,
      college: u.college, college_code: u.college_code, college_id: u.college_id,
      solved: st.solved, penalty: st.penalty, last_ac_at: st.lastAc,
      cells: probs.map((p) => {
        const c = st.cells.get(p.id);
        return c ? { label: p.label, tried: 1, ac: c.ac, fails: c.fails, time: c.ac ? c.acMin : 0 } : { label: p.label, tried: 0, ac: 0, fails: 0, time: 0 };
      }),
    });
  }
  rows.sort((a, b) => b.solved - a.solved || a.penalty - b.penalty || a.last_ac_at - b.last_ac_at || a.handle.localeCompare(b.handle));
  rows.forEach((r, i) => (r.place = i + 1));

  const probMeta = [];
  const agg = await problemAgg(probs.map((p) => p.id));
  for (const p of probs) {
    const a = agg(p.id);
    probMeta.push({
      ...p, accepted: a.accepted, attempts: a.attempts,
      solves_in_contest: subs.filter((s) => s.problem_id === p.id && s.status === 'accepted').length,
    });
  }
  return { problems: probMeta, rows, registered: partIds.size };
}

/** ---------- rating engine (simplified Elo, applied once per finished contest) ---------- */
export async function computeContestRatings(contestId) {
  const contest = await db.get('SELECT * FROM contests WHERE id = ?', [contestId]);
  if (!contest || contest.rated !== 1 || now() < contest.end_at) return null;
  const done = await db.get('SELECT id FROM rating_events WHERE contest_id = ? LIMIT 1', [contestId]);
  if (done) return null; // idempotent

  const { rows } = await buildStandings(contest);
  const participants = rows.filter((r) => r.solved > 0 && r.rating != null);
  if (participants.length < 3) return null;

  const K = 32;
  const out = [];
  const n = participants.length;
  for (let i = 0; i < n; i++) {
    const a = participants[i];
    const S = n > 1 ? 1 - i / (n - 1) : 0.5;
    let E = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      E += 1 / (1 + Math.pow(10, (participants[j].rating - a.rating) / 400));
    }
    E /= n - 1;
    const delta = clamp(Math.round(K * (S - E)), -200, 200);
    const nr = Math.max(800, a.rating + delta);
    out.push({ user_id: a.user_id, old: a.rating, new: nr, delta, rank: a.place });
  }

  for (const e of out) {
    await db.run('UPDATE users SET rating = ? WHERE id = ?', [e.new, e.user_id]);
    await db.run('UPDATE users SET peak = ? WHERE id = ? AND peak < ?', [e.new, e.user_id, e.new]);
    await db.run(
      'INSERT INTO rating_events (id, user_id, contest_id, old_rating, new_rating, delta, rank, computed_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid('re'), e.user_id, contestId, e.old, e.new, e.delta, e.rank, now()]);
  }
  return { contest_id: contestId, rated: out.length, events: out };
}

/** ---------- achievements (all derived from real records) ---------- */
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Get your first Accepted verdict.' },
  { id: 'solver_10', name: 'Ten Down', desc: 'Solve 10 distinct problems.' },
  { id: 'solver_50', name: 'Fifty Strong', desc: 'Solve 50 distinct problems.' },
  { id: 'hard_solver', name: 'Into the Fire', desc: 'Solve a Hard-rated problem.' },
  { id: 'polyglot', name: 'Polyglot', desc: 'Get Accepted in three different languages.' },
  { id: 'contest_win', name: 'Champion', desc: 'Finish 1st in a rated contest.' },
  { id: 'top10', name: 'Top Ten', desc: 'Place in the top 10 of a contest.' },
  { id: 'expert', name: 'Expert', desc: 'Reach a rating of 1600+.' },
  { id: 'candidate_master', name: 'Candidate Master', desc: 'Reach a rating of 1900+.' },
  { id: 'master', name: 'Master', desc: 'Reach a rating of 2100+.' },
  { id: 'night_owl', name: 'Night Owl', desc: 'Submit between 00:00 and 05:00.' },
  { id: 'consistency', name: 'Daily Grind', desc: 'Accept solutions on 7 different days.' },
];

export async function checkAchievements(userId) {
  const has = new Set((await db.all('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]))
    .map((r) => r.achievement_id));
  const grant = async (key) => {
    if (has.has(key)) return false;
    await db.run('INSERT INTO user_achievements (user_id, achievement_id, earned_at) VALUES (?,?,?)', [userId, key, now()]);
    return true;
  };
  const earned = [];
  const one = async (sql, params) => { const r = await db.get(sql, params); return r ? (r.c ?? 1) : 0; };

  const acc = await one("SELECT COUNT(*) AS c FROM submissions WHERE user_id=? AND status='accepted'", [userId]);
  if (acc > 0 && await grant('first_blood')) earned.push('first_blood');
  const distinct = await one("SELECT COUNT(DISTINCT problem_id) AS c FROM submissions WHERE user_id=? AND status='accepted'", [userId]);
  if (distinct >= 10 && await grant('solver_10')) earned.push('solver_10');
  if (distinct >= 50 && await grant('solver_50')) earned.push('solver_50');
  if (await one(`SELECT COUNT(*) AS c FROM submissions s JOIN problems p ON p.id=s.problem_id
                 WHERE s.user_id=? AND s.status='accepted' AND p.difficulty IN ('Hard','Insane')`, [userId]) && await grant('hard_solver')) earned.push('hard_solver');
  const langs = await one("SELECT COUNT(DISTINCT lang) AS c FROM submissions WHERE user_id=? AND status='accepted'", [userId]);
  if (langs >= 3 && await grant('polyglot')) earned.push('polyglot');
  if (await one('SELECT COUNT(*) AS c FROM rating_events WHERE user_id=? AND rank=1', [userId]) && await grant('contest_win')) earned.push('contest_win');
  if (await one('SELECT COUNT(*) AS c FROM rating_events WHERE user_id=? AND rank<=10', [userId]) && await grant('top10')) earned.push('top10');
  const u = await db.get('SELECT rating FROM users WHERE id=?', [userId]);
  if (u?.rating >= 1600 && await grant('expert')) earned.push('expert');
  if (u?.rating >= 1900 && await grant('candidate_master')) earned.push('candidate_master');
  if (u?.rating >= 2100 && await grant('master')) earned.push('master');
  if (await one("SELECT COUNT(*) AS c FROM submissions WHERE user_id=?", [userId])) {
    const rows = await db.all('SELECT created_at FROM submissions WHERE user_id = ?', [userId]);
    if (rows.some((r) => { const h = new Date(r.created_at).getHours(); return h >= 0 && h < 5; }) && await grant('night_owl')) earned.push('night_owl');
  }
  const days = await db.all("SELECT DISTINCT (created_at / 86400000) AS d FROM submissions WHERE user_id=? AND status='accepted'", [userId]);
  if (days.length >= 7 && await grant('consistency')) earned.push('consistency');
  return earned;
}

/** ---------- system status (all values from live queries) ---------- */
let queueRef = null;
export const bindQueue = (q) => (queueRef = q);

export async function systemStatus(caps) {
  const t = now();
  const [cLive, cUp, cDone, pCount, users, subsHour, accToday, perf, lastSub] = await Promise.all([
    db.get("SELECT COUNT(*) AS c FROM contests WHERE ? >= start_at AND ? < end_at", [t, t]),
    db.get('SELECT COUNT(*) AS c FROM contests WHERE start_at > ?', [t]),
    db.get("SELECT COUNT(*) AS c FROM contests WHERE end_at <= ?", [t]),
    db.get('SELECT COUNT(*) AS c FROM problems', []),
    db.get('SELECT COUNT(*) AS c FROM users', []),
    db.get('SELECT COUNT(*) AS c FROM submissions WHERE created_at > ?', [t - 3600000]),
    db.get("SELECT COUNT(*) AS c FROM submissions WHERE status='accepted' AND judged_at > ?", [t - 86400000]),
    db.all("SELECT time_ms FROM submissions WHERE status='accepted' ORDER BY judged_at DESC LIMIT 50", []),
    db.get('SELECT MAX(created_at) AS m FROM submissions', []),
  ]);
  const times = (perf || []).map((r) => r.time_ms).sort((a, b) => a - b);
  return {
    server_time: t,
    contests: { live: cLive?.c || 0, upcoming: cUp?.c || 0, completed: cDone?.c || 0 },
    problems_available: pCount?.c || 0,
    members: users?.c || 0,
    online_users: presence().online_users,
    submissions_last_hour: subsHour?.c || 0,
    accepted_today: accToday?.c || 0,
    queue_depth: queueRef ? queueRef.depth : 0,
    judge_slots: config.judge.concurrency,
    median_run_ms: times.length ? times[Math.floor(times.length / 2)] : null,
    last_activity: lastSub?.m || null,
    judge: caps || null,
  };
}

/** ---------- college rankings ---------- */
export async function collegeRanking() {
  const cols = await db.all('SELECT * FROM colleges ORDER BY name', []);
  const out = [];
  for (const c of cols) {
    const members = await db.all('SELECT id, handle, rating FROM users WHERE college_id = ? ORDER BY rating DESC', [c.id]);
    if (!members.length) continue;
    const solves = await db.get(
      `SELECT COUNT(DISTINCT s.problem_id) AS c FROM submissions s JOIN users u ON u.id = s.user_id
       WHERE u.college_id = ? AND s.status='accepted'`, [c.id]);
    const top5 = members.slice(0, 5).reduce((a, m) => a + Math.max(0, m.rating - 1400), 0);
    out.push({
      id: c.id, name: c.name, code: c.code, city: c.city,
      members: members.length,
      best: members[0]?.rating ?? 1500,
      avg_top5: Math.round(members.slice(0, 5).reduce((a, m) => a + m.rating, 0) / Math.min(5, members.length)),
      accepted: solves?.c || 0,
      score: top5 + 25 * (solves?.c || 0),
    });
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((c, i) => (c.place = i + 1));
  return out;
}
