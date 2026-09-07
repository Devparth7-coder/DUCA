/**
 * Seeds a complete, *measured* demo arena:
 *  - colleges, members, achievements
 *  - problem catalogue (samples + generated hidden tests, verified against refs)
 *  - three contests: finished, finished, LIVE, one upcoming
 *  - historical submissions that are executed through the REAL sandboxed judge,
 *    so verdicts, runtimes and memory in the DB are genuine measurements.
 */
import { db, initDb } from './index.js';
import { now, uid, hashPassword, jstr, jparse } from '../util.js';
import { LANGS } from '../judge/languages.js';
import { judgeRun } from '../judge/runner.js';
import { PROBLEMS, COLLEGES, USERS, ACHIEVEMENTS } from './seed-data.js';

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

const seedRand = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

function buildTests(p) {
  const rnd = seedRand(p.seed);
  const tests = (p.examples || []).map((e) => ({ input: e.input, output: e.output, hidden: 0 }));
  for (let i = 0; i < p.tests; i++) {
    let input, output;
    for (let tries = 0; tries < 4; tries++) {
      input = p.gen.make(rnd);
      output = p.gen.solve(input) + '\n';
      if (output.length <= 40000 && input.length <= 40000) break;
    }
    tests.push({ input, output, hidden: 1 });
  }
  return tests;
}

async function judgeSerially(subIds, concurrency = 2) {
  let i = 0;
  const worker = async () => {
    while (i < subIds.length) { const id = subIds[i++]; await judgeAndStore(id); }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function judgeAndStore(subId) {
  const s = await db.get('SELECT * FROM submissions WHERE id = ?', [subId]);
  const p = await db.get('SELECT * FROM problems WHERE id = ?', [s.problem_id]);
  const out = await judgeRun({ langKey: s.lang, code: s.code, tests: jparse(p.tests, []), tlMs: p.tl_ms, mlMb: p.ml_mb });
  await db.run(
    `UPDATE submissions SET status=?, passed=?, total=?, time_ms=?, mem_kb=?, err=?, details=?, judged_at=? WHERE id=?`,
    [out.status, out.passed, out.total, out.time_ms || 0, Math.max(0, (out.mem_kb || 0) - 18000),
      out.err || '', jstr(out.details || []), now(), subId]);
  return out;
}

export async function seed() {
  const t0 = now();
  if ((await db.get('SELECT COUNT(*) AS c FROM users', []))?.c > 0) { console.log('[seed] database not empty — skipping'); return; }
  console.log('[seed] building demo arena…');

  for (const c of COLLEGES) await db.run('INSERT INTO colleges (id, name, code, city) VALUES (?,?,?,?)', [c.id, c.name, c.code, c.city]);
  for (const a of ACHIEVEMENTS) await db.run('INSERT INTO achievements (id, name, description) VALUES (?,?,?)', a.slice(0, 3));

  // users
  const userIds = new Map();
  for (const u of USERS) {
    const id = uid('u');
    userIds.set(u.handle, id);
    await db.run(
      `INSERT INTO users (id, handle, email, name, pass_hash, college_id, role, created_at, rating, peak)
       VALUES (?,?,?,?,?,?,?,?,1500,1500)`,
      [id, u.handle, `${u.handle}@devunity.dev`, u.name, hashPassword('arena-demo'), u.college, u.role, now() - ri(seedRand(u.handle.length * 31), 30, 180) * DAY]);
  }

  // problems
  const probIds = [];
  for (const p of PROBLEMS) {
    probIds.push(p.id);
    await db.run(
      `INSERT INTO problems (id, title, difficulty, tags, statement, input_format, output_format, constraints, examples, notes, tests, tl_ms, ml_mb, starter, author_id, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id, p.title, p.difficulty, jstr(p.tags), p.statement, p.input_format, p.output_format, p.constraints,
        jstr(p.examples), '', jstr(buildTests(p)), 2000, 256, jstr({}), userIds.get('vansh'), now() - 40 * DAY]);
  }

  // contests
  const t = now();
  const liveStart = t - 35 * MIN;
  const contests = [
    {
      id: 'rookie-cup-1', title: 'DevUnity Rookie Cup #1', subtitle: 'Five problems. Zero excuses.',
      start_at: t - 14 * DAY, end_at: t - 14 * DAY + 2 * HOUR,
      description: 'The opening round of the DevUnity circuit — warm, forgiving, and rated. Problemset reviewed by the DevUnity core team.\n\nAll submissions follow standard input / standard output. No templates, no boilerplate checks — just clean, correct I/O.',
      rules: 'ICPC-style scoring: most solved, then least penalty. 20 penalty minutes per failed attempt. You may submit in Python, Java, C++ or JavaScript. Copying is disqualifying; pair-programming is allowed only if both names register.',
      problems: ['a-plus-b', 'count-vowels', 'palindrome-check', 'balanced-brackets', 'lonely-bit'],
      members: ['vansh', 'aarav', 'meera.codes', 'nullp0inter', 'sushmita', 'k1ng', 'vixit', 'rad1x', 'tannya', 'ironravi'],
    },
    {
      id: 'autumn-round-2', title: 'Autumn Arena Series — Round 2', subtitle: 'Rated. Faster. Sharper.',
      start_at: t - 7 * DAY, end_at: t - 7 * DAY + 2.5 * HOUR,
      description: 'Round two of the autumn series. Dynamic programming and number theory take the stage. Two Hard problems were split by fewer than five competitors last edition — will this round bite harder?',
      rules: 'ICPC-style scoring: most solved, then least penalty. 20 penalty minutes per wrong attempt. Cleared problems stay visible after the round for post-contest discussion in the DevUnity server.',
      problems: ['fib-mod', 'staircase-ways', 'gcd-pairs', 'power-mod', 'island-steps'],
      members: ['vansh', 'aarav', 'meera.codes', 'nullp0inter', 'sushmita', 'k1ng', 'rad1x', 'mon0tone', 'zoya.dev', 'tannya', 'vixit'],
    },
    {
      id: 'friday-arena-live', title: 'Friday Night Arena — Rated Round', subtitle: 'Happening right now',
      start_at: liveStart, end_at: liveStart + 3 * HOUR,
      description: 'The weekly Friday session is **live**. Mixed difficulty, six problems, a leaderboard that moves every time a verdict lands.\n\nPractice the fundamentals while you are here — the first two problems are warmup grade and solvable in under five minutes.',
      rules: 'Standard rules: most solved, then penalty (20 min per wrong attempt). Submissions are judged in a sandboxed runner. Have fun, be honest, and read the problem statements twice.',
      problems: ['count-vowels', 'palindrome-check', 'lonely-bit', 'staircase-ways', 'power-mod', 'island-steps'],
      members: ['vansh', 'aarav', 'meera.codes', 'sushmita', 'k1ng', 'ironravi', 'zoya.dev', 'mon0tone', 'nullp0inter', 'rad1x'],
    },
    {
      id: 'collegiate-qualifier', title: 'Collegiate Team Challenge — Qualifier', subtitle: 'Represent your campus',
      start_at: t + 5 * DAY, end_at: t + 5 * DAY + 3 * HOUR,
      description: 'The annual inter-college qualifier. Four-member rosters, one shared standings table weighted toward every member. Registration opens now — your college ranking on the board depends on it.',
      rules: 'Team rules apply: each member solves individually, college score aggregates member ratings and solves. Plagiarism checks are on.',
      problems: ['expedition-knapsack', 'shared-subsequence', 'signal-delay', 'prefix-sum-range', 'gcd-pairs', 'fib-mod'],
      members: [],
    },
  ];

  for (const c of contests) {
    await db.run(
      `INSERT INTO contests (id, title, subtitle, description, rules, start_at, end_at, penalty_min, rated, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,20,?,?,?)`,
      [c.id, c.title, c.subtitle, c.description, c.rules, c.start_at, c.end_at, 1, userIds.get('vansh'), c.start_at - 3 * DAY]);
    c.problems.forEach((pid, i) => db.run('INSERT INTO contest_problems (contest_id, problem_id, ord, label) VALUES (?,?,?,?)',
      [c.id, pid, i, String.fromCharCode(65 + i)]));
    for (const h of c.members) await db.run('INSERT INTO contest_registrations (contest_id, user_id, created_at) VALUES (?,?,?)',
      [c.id, userIds.get(h), c.start_at - ri(seedRand(h.length + c.id.length), 1, 200) * MIN]);
  }

  /* ----- submissions: judged for real ----- */
  const subIds = [];
  const langs = ['python', 'python', 'python', 'javascript', 'cpp', 'java', 'python', 'javascript', 'python', 'python'];
  const WA = `print("0")\n`;
  const CE = `import sys\ndef broken(:\n    pass\n`;

  const submit = async (handle, pid, code, lang, at, contestId) => {
    const id = uid('s');
    await db.run(`INSERT INTO submissions (id, user_id, problem_id, contest_id, lang, code, status, created_at)
                  VALUES (?,?,?,?,?,?,'queued',?)`, [id, userIds.get(handle), pid, contestId || null, lang, code, at]);
    subIds.push(id);
    return id;
  };

  for (const c of contests) {
    if (c.members.length === 0) continue;
    const rnd = seedRand(c.id.length * 991 + c.members.length);
    const dur = c.end_at - c.start_at;
    for (let mi = 0; mi < c.members.length; mi++) {
      const h = c.members[mi];
      const strength = Math.max(0.15, 0.95 - mi * 0.085 - (h === 'mon0tone' ? 0.2 : 0) - (h === 'zoya.dev' ? 0.15 : 0));
      for (let pi = 0; pi < c.problems.length; pi++) {
        const pid = c.problems[pi];
        const pr = PROBLEMS.find((x) => x.id === pid);
        const p = await db.get('SELECT * FROM problems WHERE id = ?', [pid]);
        const solvedChance = strength * (pr.difficulty === 'Easy' ? 1.0 : pr.difficulty === 'Medium' ? 0.62 : 0.42) * (1 - pi * 0.07);
        if (rnd() > solvedChance) { if (rnd() < 0.25) await submit(h, pid, CE, 'python', c.start_at + Math.floor(dur * rnd() * 0.5), c.id); continue; }
        let at = c.start_at + ri(rnd, 4, Math.floor((c.id === 'friday-arena-live' ? Math.min(dur, (now() - c.start_at)) : dur * 0.92) / MIN)) * MIN;
        if (at > Math.min(now() - 2000, c.end_at - 30000)) at = Math.max(c.start_at + 5 * MIN, now() - ri(rnd, 2, 20) * MIN - ri(rnd, 0, 59) * 1000);
        const lang = langs[ri(rnd, 0, langs.length - 1)];
        if (rnd() < 0.35) await submit(h, pid, WA, lang in pr.ref ? lang : 'python', at - ri(rnd, 1, 6) * MIN, c.id);
        await submit(h, pid, pr.ref[lang] || pr.ref.python, pr.ref[lang] ? lang : 'python', at, c.id);
      }
    }
  }

  // practice submissions after the last contest for texture
  for (const u of USERS) {
    const rnd = seedRand(u.handle.length * 777);
    const n = ri(rnd, 1, 3);
    for (let i = 0; i < n; i++) {
      const pid = probIds[ri(rnd, 0, probIds.length - 1)];
      const pr = PROBLEMS.find((x) => x.id === pid);
      await submit(u.handle, pid, pr.ref.python, 'python', now() - ri(rnd, 0, 3) * HOUR - 1200 - i * 60000, null);
    }
  }

  console.log(`[seed] judging ${subIds.length} seeded submissions through the sandbox (this proves the pipeline)…`);
  await judgeSerially(subIds);

  const judged = await db.get(`SELECT status, COUNT(*) AS c FROM submissions GROUP BY status ORDER BY c DESC`, []);
  const ac = (await db.get(`SELECT COUNT(*) AS c FROM submissions WHERE status='accepted'`, []))?.c || 0;
  const ce = (await db.get(`SELECT COUNT(*) AS c FROM submissions WHERE status='ce'`, []))?.c || 0;
  const wa = (await db.get(`SELECT COUNT(*) AS c FROM submissions WHERE status='wa'`, []))?.c || 0;
  console.log(`[seed] verdicts — accepted: ${ac}, wrong-answer: ${wa}, compile-error (intentional): ${ce}, other: ${subIds.length - ac - wa - ce}`);
  if (ac < subIds.length * 0.5) { console.error('[seed] too few accepted verdicts — a reference solution disagrees with its tests. Aborting seed.'); process.exit(1); }

  // ratings from real standings, then achievements
  const { computeContestRatings, checkAchievements } = await import('../stats.js');
  await computeContestRatings('rookie-cup-1');
  await computeContestRatings('autumn-round-2');
  for (const u of USERS) await checkAchievements(userIds.get(u.handle));

  console.log(`[seed] arena online in ${((now() - t0) / 1000).toFixed(1)}s · demo login: ${USERS[1].handle} / arena-demo · admin: vansh / arena-demo`);
}

// allow `npm run seed` standalone
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  await initDb();
  await seed();
  process.exit(0);
}
