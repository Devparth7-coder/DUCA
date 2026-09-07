#!/usr/bin/env node
/* End-to-end smoke test against a running CodeArena server (default :8080).
   Exercises: time sync, status, auth, problem fetch, RUN on samples, SUBMIT →
   judged verdict via queue, standings, rating data, SSE stream, CSRF guard. */
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
let cookie = '';
let pass = 0, fail = 0;

async function req(path, { method, body, noHeader = false, rawCookie } = {}) {
  if (!method) method = body ? 'POST' : 'GET';
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(noHeader ? {} : { 'x-requested-with': 'codearena' }),
      ...(cookie || rawCookie ? { cookie: (rawCookie || '') + cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc?.includes('ca_session')) cookie = sc.split(',')[0].split(';')[0];
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text.slice(0, 80) }; }
  return { status: res.status, json };
}
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
  return ok;
}

const t0 = Date.now();
const main = async () => {
  console.log('[smoke] target', BASE);

  let r = await req('/api/time');
  check('time endpoint', r.status === 200 && r.json.server_time > 1e12, JSON.stringify(r.json));
  const skew = Math.abs(r.json.server_time - Date.now());
  check('server clock within 5s of client', skew < 5000, `skew=${skew}ms`);

  r = await req('/api/system/status');
  const st = r.json;
  check('status: problems from db', st.problems_available >= 14, JSON.stringify(st.problems_available));
  check('status: judge caps exposed', !!st.judge && Object.keys(st.judge.languages).length === 4, JSON.stringify(st.judge?.languages || null));
  check('status: live contests counted', st.contests.live >= 1, JSON.stringify(st.contests));
  check('status: no fabricated fields', 'accepted_today' in st && 'queue_depth' in st);

  r = await req('/api/auth/login', { noHeader: true, body: { login: 'aarav', password: 'arena-demo' } });
  check('CSRF guard blocks headerless POST', r.status === 403, JSON.stringify(r.json));

  r = await req('/api/auth/register', { body: { handle: 'smoke' + (t0 % 100000), name: 'Smoke Tester', email: `smoke${t0 % 100000}@devunity.dev`, password: 'smoketest123' } });
  check('register', r.status === 200 && r.json.user?.handle, JSON.stringify(r.json).slice(0, 120));

  r = await req('/api/auth/me');
  check('session cookie auth', r.json.user?.role === 'user', JSON.stringify(r.json).slice(0, 100));

  r = await req('/api/problems/a-plus-b');
  check('problem fetch', r.json.problem?.title?.includes('Sum'), '');
  check('hidden tests withheld', !JSON.stringify(r.json).includes('"tests"'));

  const good = 'import sys\nprint(sum(map(int, sys.stdin.read().split())))\n';
  r = await req('/api/judge/run', { body: { problem_id: 'a-plus-b', language: 'python', code: good } });
  check('RUN on samples passes', r.status === 200 && r.json.status === 'accepted', JSON.stringify(r.json).slice(0, 160));

  r = await req('/api/judge/run', { body: { problem_id: 'a-plus-b', language: 'python', code: 'print(12345)\n' } });
  check('RUN catches wrong answer', r.json.status === 'wa', JSON.stringify(r.json).slice(0, 120));

  r = await req('/api/judge/submit', { body: { problem_id: 'a-plus-b', language: 'python', code: good } });
  const sid = r.json.id;
  check('submit queued', !!sid, JSON.stringify(r.json));
  let verdict = null;
  for (let i = 0; i < 40 && !verdict; i++) {
    await new Promise((s) => setTimeout(s, 800));
    const rr = await req('/api/submissions/' + sid);
    if (!['queued', 'judging'].includes(rr.json.submission?.status)) verdict = rr.json.submission;
  }
  check('SUBMIT judged → accepted', verdict?.status === 'accepted', JSON.stringify(verdict).slice(0, 140));
  check('real timing recorded', typeof verdict?.time_ms === 'number' && verdict.time_ms >= 0, '');

  r = await req('/api/contests');
  const liveC = r.json.items.find((c) => c.status === 'live');
  check('contest list: statuses computed', !!liveC, JSON.stringify(r.json.items.map((c) => c.status)));

  r = await req('/api/contests/' + liveC.id + '/standings');
  check('standings computed', r.json.rows.length > 0 && typeof r.json.rows[0].penalty === 'number', '');

  r = await req('/api/contests/' + liveC.id + '/register', { body: {} });
  check('contest register', r.json.ok === true, '');
  r = await req('/api/judge/submit', { body: { problem_id: 'count-vowels', language: 'python', code: "import sys\nprint(sum(c in 'aeiou' for c in sys.stdin.read().strip()))\n", contest_id: liveC.id } });
  check('contest submit accepted', !!r.json.id, JSON.stringify(r.json));
  let cv = null;
  for (let i = 0; i < 40 && !cv; i++) {
    await new Promise((s) => setTimeout(s, 800));
    const rr = await req('/api/submissions/' + r.json.id);
    if (!['queued', 'judging'].includes(rr.json.submission?.status)) cv = rr.json.submission;
  }
  check('contest submission judged accepted', cv?.status === 'accepted', JSON.stringify(cv).slice(0, 140));

  r = await req('/api/leaderboard?limit=5');
  check('leaderboard sorted by rating', r.json.items[0].rating >= r.json.items[1].rating, '');
  r = await req('/api/users/aarav');
  check('profile has real history', r.json.rating_history.length > 0 && r.json.activity.length > 0, '');
  r = await req('/api/leaderboard/colleges');
  check('college rankings computed', r.json.rows.length >= 5, '');

  // SSE stream
  const sse = await new Promise((resolve) => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(BASE + '/api/stream', { headers: cookie ? { cookie } : {}, signal: ac.signal });
        const rd = res.body.getReader();
        const { value } = await Promise.race([rd.read(), new Promise((s) => setTimeout(() => s({ value: null }), 4000))]);
        ac.abort();
        resolve(new TextDecoder().decode(value || new Uint8Array()));
      } catch { resolve(''); }
    })();
  });
  check('SSE hello with server time', sse.includes('event: hello') && sse.includes('server_time'), sse.slice(0, 80));

  console.log(`\n[smoke] ${pass} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(fail ? 1 : 0);
};
main().catch((e) => { console.error('[smoke] fatal', e); process.exit(1); });
