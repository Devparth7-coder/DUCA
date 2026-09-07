import { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { api, fmt, serverNow } from '../lib/api.js';
import { Reveal, Countdown, ContestStatus, Rating, Verdict } from '../components/ui.jsx';
import { Avatar } from '../components/Nav.jsx';

/* ---------- hero canvas: animated grid + rating particles + cursor parallax ---------- */
function ArenaCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d');
    let w, h, raf, t = 0;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const glyphs = ['{ }', '=>', '++', '01', 'O(n)', '<<', '</>', '&&', '!=', 'λ', '#!', '::', '^='];
    const frags = Array.from({ length: 26 }, () => ({
      x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 0.8,
      v: 0.00012 + Math.random() * 0.00035, g: glyphs[(Math.random() * glyphs.length) | 0],
      a: 0.05 + Math.random() * 0.16, ph: Math.random() * 6.28,
    }));
    const parts = Array.from({ length: 44 }, (_, i) => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006, r: 0.6 + Math.random() * 1.5,
    }));
    const resize = () => {
      w = cv.width = cv.clientWidth * devicePixelRatio;
      h = cv.height = cv.clientHeight * devicePixelRatio;
    };
    const onMove = (e) => { mouse.tx = e.clientX / innerWidth; mouse.ty = e.clientY / innerHeight; };
    resize(); addEventListener('resize', resize); addEventListener('pointermove', onMove);
    const draw = () => {
      t++;
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      ctx.clearRect(0, 0, w, h);
      // grid
      const gs = 46 * devicePixelRatio, ox = (mouse.x - 0.5) * 26, oy = (mouse.y - 0.5) * 26;
      ctx.strokeStyle = 'rgba(255,255,255,0.028)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -gs + (ox % gs); x < w + gs; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = -gs + (oy % gs); y < h + gs; y += gs) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      // horizon glow line sweeping like a progress bar
      const sweep = ((t * 0.6) % (h + 300)) - 150;
      const g = ctx.createLinearGradient(0, sweep - 120, 0, sweep + 120);
      g.addColorStop(0, 'rgba(124,140,255,0)'); g.addColorStop(0.5, 'rgba(124,140,255,0.05)'); g.addColorStop(1, 'rgba(124,140,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, sweep - 120, w, 240);
      // floating code fragments
      ctx.font = `${11.5 * devicePixelRatio}px "JetBrains Mono", monospace`;
      for (const f of frags) {
        f.y -= f.v; if (f.y < -0.08) { f.y = 1.08; f.x = Math.random(); }
        const fx = f.x * w + Math.sin(t / 70 + f.ph) * 8 + ox * f.s * 1.6;
        const fy = f.y * h + oy * f.s * 1.6;
        ctx.fillStyle = `rgba(168,175,194,${f.a})`;
        ctx.fillText(f.g, fx, fy);
      }
      // particles + constellation links (players moving on the board)
      const px = parts.map((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        return [p.x * w + ox * 3, p.y * h + oy * 3, p.r];
      });
      ctx.lineWidth = 1;
      for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) {
        const dx = px[i][0] - px[j][0], dy = px[i][1] - px[j][1], d2 = dx * dx + dy * dy;
        const lim = (110 * devicePixelRatio) ** 2;
        if (d2 < lim) {
          ctx.strokeStyle = `rgba(55,226,197,${(0.16 * (1 - d2 / lim)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(px[i][0], px[i][1]); ctx.lineTo(px[j][0], px[j][1]); ctx.stroke();
        }
      }
      for (const [x, y, r] of px) {
        ctx.fillStyle = 'rgba(190,200,255,0.5)';
        ctx.beginPath(); ctx.arc(x, y, r * devicePixelRatio, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); };
  }, []);
  return <canvas ref={ref} className="hero-grid-canvas" aria-hidden="true" />;
}

/* ---------- hero side panel: live micro-dashboard (real queries) ---------- */
function ArenaPulse() {
  const { status, on } = useApp();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    const load = () => api.get('/api/submissions?limit=7').then((r) => setRows(r.items)).catch(() => {});
    load();
    const iv = setInterval(load, 12000);
    const off = on('submission', load);
    return () => { clearInterval(iv); off(); };
  }, [on]);

  return (
    <div className="card" style={{ padding: 0, backdropFilter: 'blur(10px)', background: 'rgba(10,12,17,.72)' }}>
      <div className="spread" style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
        <span className="tiny mono" style={{ color: 'var(--ink-2)' }}>ARENA · LIVE</span>
        <span className="row" style={{ gap: 6 }}>
          <span className="livedot" />
          <span className="tiny mono dim2">{status ? `${status.submissions_last_hour} sub/h` : 'syncing'}</span>
        </span>
      </div>
      <div style={{ padding: '10px 16px 6px', display: 'grid', gap: 2, minHeight: 218 }}>
        {!rows && Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 30, margin: '4px 0' }} />)}
        {rows?.slice(0, 6).map((s, i) => (
          <div key={s.id} className="row small mono" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,.04)' : 0 }}>
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <Avatar handle={s.handle} size={16} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.handle}</span>
              <span className="dim2">→</span><span className="dim">{s.problem_id}</span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <span className="dim2">{fmt.ago(s.created_at)}</span>
              <Verdict status={s.status} />
            </span>
          </div>
        ))}
      </div>
      <Link to="/submissions" style={{ display: 'block', padding: '9px 16px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
        Full live feed →
      </Link>
    </div>
  );
}

export function Home() {
  const { status, user } = useApp();
  const [live, setLive] = useState(null);
  const [top, setTop] = useState([]);

  useEffect(() => {
    api.get('/api/contests').then((r) => {
      const items = r.items;
      setLive(items.find((c) => c.status === 'live') || items.find((c) => c.status === 'upcoming') || null);
    }).catch(() => {});
    api.get('/api/leaderboard?limit=8').then((r) => setTop(r.items || [])).catch(() => {});
  }, [status?.contests?.live]);

  const s = status;
  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero">
        <ArenaCanvas />
        <div className="container hero-inner">
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.35fr) minmax(300px, .65fr)', alignItems: 'end', gap: 40 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 20 }}>DevUnity Tech Club · Competitive Programming Platform</p>
              <h1 className="display">ENTER<br />THE <span className="stroke">ARENA.</span></h1>
              <p className="hero-sub" style={{ marginTop: 18 }}>Code. Compete. Rise.</p>
              <p className="hero-body">
                DevUnity CodeArena is a competitive coding platform built for the next generation of
                developers — rated contests, a sandboxed multi-language judge, and a leaderboard that
                updates the moment a verdict lands.
              </p>
              <div className="hero-cta">
                <Link to={user ? '/contests' : '/auth/register'} className="btn btn-primary btn-lg">Enter CodeArena</Link>
                <Link to="/contests" className="btn btn-lg">Explore Contests</Link>
              </div>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              <ArenaPulse />
            </div>
          </div>

          {/* live platform strip — every value from the backend */}
          <div className="hero-stats">
            {[
              ['Active contests', s ? s.contests.live : '—', s && s.contests.upcoming > 0 ? `+${s.contests.upcoming} upcoming` : null],
              ['Developers online', s ? s.online_users : '—', s ? `${s.members} registered` : null],
              ['Problems available', s ? s.problems_available : '—', s ? (s.median_run_ms != null ? `median run ${s.median_run_ms}ms` : 'sandbox idle') : null],
              ['Submissions · last hour', s ? s.submissions_last_hour : '—', s ? `queue ${s.queue_depth}` : null],
            ].map(([l, v, sub]) => (
              <div className="cell" key={l}>
                <div className="num">{typeof v === 'number' ? v.toLocaleString() : v}</div>
                <div className="lbl">{l}</div>
                {sub && <div className="tiny mono dim2" style={{ marginTop: 4 }}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURE RAIL ================= */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          <Reveal>
            <div className="spread" style={{ marginBottom: 28 }}>
              <h2 className="sect">Four verbs. One platform.</h2>
              <span className="chip mono">v1 · first release</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="feat">
              {FEATURES.map((f, i) => (
                <div className="f" key={f.k}>
                  <div className="glow" />
                  <div className="k">{String(i + 1).padStart(2, '0')} / {f.k}</div>
                  <div className="t">{f.t}</div>
                  <div className="d">{f.d}</div>
                  <div style={{ marginTop: 16 }}>{f.cta}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= LIVE / NEXT CONTEST ================= */}
      {live && (
        <section className="section" style={{ paddingTop: 8 }}>
          <div className="container">
            <Reveal>
              <div className="contest-head" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'center', padding: '30px 32px' }}>
                <div>
                  <ContestStatus status={live.status} />
                  <h3 style={{ fontSize: 26, margin: '10px 0 4px', letterSpacing: '-.02em' }}>{live.title}</h3>
                  <p className="dim small" style={{ maxWidth: 560 }}>{live.subtitle} · {fmt.date(live.start_at)} → {fmt.date(live.end_at)} · {fmt.dur(live.duration_ms)}</p>
                  <div className="row" style={{ marginTop: 16, gap: 22 }}>
                    <div><span className="bignum" style={{ fontSize: 22 }}>{live.registered}</span> <span className="small dim">registered</span></div>
                    <div><span className="bignum" style={{ fontSize: 22 }}>{live.problems}</span> <span className="small dim">problems</span></div>
                    <div><span className="small dim">rated · ICPC penalty {20}min</span></div>
                  </div>
                  {live.status === 'live' && (
                    <div className="progress" style={{ marginTop: 18, maxWidth: 520 }}>
                      <div style={{ width: pct(live) + '%' }} />
                    </div>
                  )}
                </div>
                <div className="stack" style={{ gap: 14, alignItems: 'end' }}>
                  <Countdown target={live.status === 'live' ? live.end_at : live.start_at} prefix={live.status === 'live' ? 'ends in' : 'starts in'} />
                  <Link to={'/contests/' + live.id} className="btn btn-primary">{live.status === 'live' ? 'Enter live contest' : 'Register & prep'}</Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ================= JUDGE ARCHITECTURE ================= */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container grid" style={{ gap: 26 }}>
          <Reveal>
            <p className="eyebrow">Infrastructure</p>
            <h2 className="sect" style={{ margin: '10px 0 12px' }}>Judging you can trust.</h2>
            <p className="dim" style={{ maxWidth: 640 }}>
              Your code never runs inside the API server. Every submission travels a queue into a
              hardened supervisor that executes it with rlimits — CPU, address space, file size, no cores —
              and measures wall time and peak RSS for every test. Verdicts are results, not decorations.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="arch">
              {[['Browser', ''], ['API', ''], ['Queue', 'hot'], ['Worker', ''], ['Sandbox', 'hot'], ['Verdict', ''], ['Realtime', '']].map(([n, c], i) => (
                <div key={i} className={'node ' + c}>
                  <div style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 12 }}>{n}</div>
                  <div className="dim2" style={{ marginTop: 4, fontSize: 10 }}>{['react app', 'node · http', 'bounded slots', 'rlimit supervisor', 'py · js · c++ · java', 'written to db', 'SSE push'][i]}</div>
                </div>
              ))}
            </div>
          </Reveal>
          {s?.judge && (
            <Reveal delay={150}>
              <div className="row mono small dim2" style={{ gap: 18, flexWrap: 'wrap' }}>
                <span className="chip">judge slots: {s.judge_slots ?? status.judge_slots}</span>
                {Object.entries(s.judge.languages || {}).map(([k, v]) => (
                  <span key={k} className="chip">{k}: {v.ok ? <span style={{ color: 'var(--ok)' }}>{v.version || 'ready'}</span> : <span style={{ color: 'var(--bad)' }}>unavailable</span>}</span>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ================= RANKINGS PREVIEW ================= */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container grid" style={{ gap: 22 }}>
          <Reveal>
            <div className="spread">
              <div>
                <p className="eyebrow">Standings</p>
                <h2 className="sect" style={{ marginTop: 8 }}>The board is the product.</h2>
              </div>
              <Link to="/rankings" className="btn btn-ghost">All rankings →</Link>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="tbl">
                <thead><tr><th style={{ width: 46 }}>#</th><th>Developer</th><th>College</th><th className="r">Rating</th><th className="r">Solved</th></tr></thead>
                <tbody>
                  {top.length === 0 && <tr><td colSpan={5}><div className="empty dim small">Loading the board…</div></td></tr>}
                  {top.map((r, i) => (
                    <tr key={r.id}>
                      <td className={'mono rank-' + (i + 1)}>{i + 1}</td>
                      <td><Link to={'/u/' + r.handle} className="row" style={{ gap: 8 }}><Avatar handle={r.handle} size={18} /><b style={{ fontWeight: 650 }}>{r.handle}</b></Link></td>
                      <td className="dim small">{r.college || '—'}</td>
                      <td className="r"><Rating value={r.rating} /></td>
                      <td className="r mono small">{r.solved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="card pad" style={{ padding: '64px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(30rem 12rem at 50% 130%, rgba(124,140,255,.18), transparent)', pointerEvents: 'none' }} />
              <h2 className="sect">Your first verdict is<br />three minutes away.</h2>
              <p className="dim" style={{ margin: '14px auto 26px', maxWidth: 520 }}>
                Register, solve the warmup problem, watch your name hit the live feed.
                The arena runs on real measurement — nothing here is faked.
              </p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link to="/auth/register" className="btn btn-primary btn-lg">Create your account</Link>
                <Link to="/problems" className="btn btn-lg">Browse problems</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

const pct = (c) => Math.min(100, Math.max(0, ((serverNow() - c.start_at) / (c.end_at - c.start_at)) * 100));

const FEATURES = [
  {
    k: 'COMPETE', t: 'COMPETE',
    d: 'Curated rated contests with real countdowns synced to server time, live standings with ICPC penalties, and a rules page that actually matches the judge.',
    cta: <Link to="/contests" className="small" style={{ color: 'var(--accent)', fontWeight: 650 }}>See the schedule →</Link>,
  },
  {
    k: 'SOLVE', t: 'SOLVE',
    d: 'A problem set that spans implementation to DP and graphs, with per-test timing and memory, hidden tests, and an editor built on Monaco — the editor VS Code ships with.',
    cta: <Link to="/problems" className="small" style={{ color: 'var(--accent)', fontWeight: 650 }}>Open the problem set →</Link>,
  },
  {
    k: 'RISE', t: 'RISE',
    d: 'Elo-style rating with a public history graph, per-difficulty analytics, achievements earned from records — never granted for decoration.',
    cta: <Link to="/rankings" className="small" style={{ color: 'var(--accent)', fontWeight: 650 }}>Climb the board →</Link>,
  },
  {
    k: 'BELONG', t: 'BELONG',
    d: 'Your college on the scoreboard. Club-to-club rivalry measured by real member ratings and solves, not vibes. Represent in the Collegiate Team Challenge.',
    cta: <Link to="/rankings?tab=colleges" className="small" style={{ color: 'var(--accent)', fontWeight: 650 }}>See college rankings →</Link>,
  },
];
