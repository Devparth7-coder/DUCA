import { useEffect, useState, useCallback } from 'react';
import { api, fmt, serverNow } from '../lib/api.js';
import { Link, useRouter } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { ContestStatus, Countdown, Verdict, Rating, CardHead, DiffTag } from '../components/ui.jsx';
import { Avatar } from '../components/Nav.jsx';

export function ContestDetail({ id }) {
  const { user, toast, status, on } = useApp();
  const { nav } = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('problems');
  const [err, setErr] = useState(null);

  const load = useCallback(() => api.get('/api/contests/' + id).then((r) => { setData(r); setErr(null); }).catch((e) => setErr(e)), [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.contest?.status !== 'live') return;
    let dirty = false;
    const flush = () => { if (dirty) { dirty = false; load(); } };
    const iv = setInterval(flush, 4000);
    const offs = [
      on('standings_changed', (d) => { if (d?.contest === id) dirty = true; }),
      on('submission', (d) => { if (d?.contest === id) dirty = true; }),
      on('contest_status', () => load()),
    ];
    return () => { clearInterval(iv); offs.forEach((f) => f()); };
  }, [data?.contest?.status, id, on, load]);

  if (err) return <div className="container section"><p className="dim">{err.message}</p><Link className="btn" to="/contests">← all contests</Link></div>;
  if (!data) return (
    <div className="container section" style={{ display: 'grid', gap: 14 }}>
      <div className="skeleton" style={{ height: 150 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );

  const c = data.contest;
  const nowMs = serverNow();
  const progress = Math.min(100, Math.max(0, ((nowMs - c.start_at) / (c.end_at - c.start_at)) * 100));

  async function register() {
    if (!user) { nav('/auth/login'); return; }
    try { await api.post(`/api/contests/${id}/register`, {}); toast('Registered — see you at start time.'); load(); }
    catch (e) { toast(e.message, 'err'); }
  }

  return (
    <div className="container" style={{ paddingTop: 34, paddingBottom: 60 }}>
      {/* ---------- header ---------- */}
      <div className={'contest-head' + (c.status === 'live' ? ' live' : '')}>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <ContestStatus status={c.status} />
              {c.rated && <span className="chip tiny mono">RATED ELO</span>}
              <span className="chip tiny mono">PENALTY {c.penalty_min}m</span>
            </div>
            <h1 style={{ fontSize: 30, letterSpacing: '-.03em', lineHeight: 1.1 }}>{c.title}</h1>
            <p className="dim small" style={{ marginTop: 4 }}>{c.subtitle}</p>
            <div className="row mono small dim2" style={{ marginTop: 12, gap: 14, flexWrap: 'wrap' }}>
              <span>{fmt.day(c.start_at)}</span><span>→</span><span>{fmt.day(c.end_at)}</span>
              <span>·</span><span>{fmt.dur(c.duration_ms)}</span>
              <span>·</span><span title="server-clock source">{fmt.num(c.registered)} registered</span>
            </div>
            {c.status === 'live' && <div className="progress" style={{ marginTop: 16, maxWidth: 480 }}><div style={{ width: progress + '%' }} /></div>}
          </div>

          <div className="stack" style={{ gap: 12, alignItems: 'flex-end' }}>
            {c.status === 'live' && <Countdown target={c.end_at} prefix="ends in" />}
            {c.status === 'upcoming' && <Countdown target={c.start_at} prefix="starts in" />}
            <div className="row" style={{ gap: 8 }}>
              {c.status !== 'finished' && !c.my_registered &&
                <button className="btn btn-primary" onClick={register}>Register</button>}
              {c.status === 'live' && <button className="btn btn-primary" onClick={() => setTab('problems')}>Solve →</button>}
              {c.status === 'finished' && <button className="btn" onClick={() => setTab('standings')}>Final standings</button>}
              {c.status === 'upcoming' && !c.my_registered && <span className="dim2 small">Registration closes at start.</span>}
            </div>
            {c.my_registered && <span className="chip tiny mono" style={{ color: 'var(--ok)', borderColor: 'rgba(61,220,151,.4)' }}>✓ registered</span>}
          </div>
        </div>

        {data.me && c.status === 'live' && (
          <div className="hero-stats" style={{ marginTop: 26, marginBottom: 0 }}>
            {[['Current rank', '#' + data.me.rank], ['Problems solved', data.me.solved + ' / ' + data.problems.length],
              ['Penalty', data.me.penalty + ' min'], ['My submissions', data.my_submissions.length]].map(([l, v]) => (
              <div className="cell" key={l}><div className="num">{v}</div><div className="lbl">{l}</div></div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- tabs ---------- */}
      <div className="row" style={{ gap: 4, margin: '22px 0 18px', borderBottom: '1px solid var(--line)' }}>
        {[['overview', 'Overview'], ['problems', 'Problems'], ['standings', 'Standings'], ['subs', 'My submissions']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="result-tab" style={{ borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent', color: tab === k ? 'var(--ink)' : 'var(--ink-3)' }}>
            {l}{k === 'subs' && data.my_submissions.length > 0 ? ` (${data.my_submissions.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(260px,1fr)', gap: 16, alignItems: 'start' }}>
          <div className="card pad prose" style={{ padding: 26 }}>
            <MarkdownLite text={c.description} />
            <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>Rules</h3>
            <MarkdownLite text={c.rules} />
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card pad stack" style={{ gap: 10 }}>
              <div className="tiny mono dim2">CONTEST CLOCK · SERVER-SYNCED</div>
              {c.status !== 'finished'
                ? <Countdown target={c.status === 'live' ? c.end_at : c.start_at} prefix="" />
                : <p className="small dim">Closed {fmt.ago(c.end_at)}. Rating changes are published to profiles.</p>}
              {c.status === 'live' && <div className="progress"><div style={{ width: progress + '%' }} /></div>}
              <div className="small dim">Starts {fmt.date(c.start_at)} · Ends {fmt.date(c.end_at)}</div>
            </div>
            <div className="card pad">
              <div className="spread"><div className="tiny mono dim2">PARTICIPANTS</div><b className="bignum" style={{ fontSize: 22 }}>{fmt.num(c.registered)}</b></div>
              <div className="small dim" style={{ marginTop: 6 }}>People on the board. Anyone who submits during the round is counted in, registered or not.</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'problems' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <CardHead title="Problemset" kicker={c.status === 'live' ? 'live — solvers update in real time' : c.status} right={<span className="chip tiny mono">{data.problems.length} problems</span>} />
          <table className="tbl">
            <thead><tr><th style={{ width: 40 }}>Label</th><th>Problem</th><th>Difficulty</th><th className="r">Solved (round)</th><th className="r">Solved (all)</th>{c.status === 'live' && <th className="r">Open</th>}</tr></thead>
            <tbody>
              {data.problems.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>{p.label}</td>
                  <td><Link to={`/problems/${p.id}/${id}`} style={{ fontWeight: 650 }}>{p.title}</Link>
                    <div className="dim tiny mono">{p.attempts} attempts · {p.attempts ? Math.round(p.accepted / p.attempts * 100) : 0}% accepted</div></td>
                  <td><DiffTag d={p.difficulty} /></td>
                  <td className="r mono">{p.solves_in_contest}</td>
                  <td className="r mono dim">{p.solvers}</td>
                  {c.status === 'live' && <td className="r"><Link className="btn btn-sm" to={`/problems/${p.id}/${id}`}>Solve →</Link></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {c.status === 'upcoming' && (
            <div className="small dim" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
              Problems are previewed; the editor unlocks when the clock hits {fmt.date(c.start_at)}.
            </div>
          )}
        </div>
      )}

      {tab === 'standings' && <Standings data={data} contestId={id} status={c.status} />}

      {tab === 'subs' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <CardHead title="My submissions" kicker="this round" />
          {data.my_submissions.length === 0 ? <div className="empty">No submissions yet — open a problem and send your first verdict request.</div> : (
            <table className="tbl">
              <tbody>
                {data.my_submissions.map((s) => (
                  <tr key={s.id}>
                    <td className="mono" style={{ color: 'var(--accent)' }}>{s.label || '·'}</td>
                    <td className="small mono">{s.problem_id}</td>
                    <td><Verdict status={s.status} /></td>
                    <td className="small mono dim">{s.passed}/{s.total}</td>
                    <td className="small mono dim">{s.time_ms}ms</td>
                    <td className="small mono dim2">{s.lang}</td>
                    <td className="r small dim2">{fmt.ago(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Standings({ data, contestId, status }) {
  const { on, user } = useApp();
  const [rows, setRows] = useState(data.standings);
  const [ratingsBy, setRatingsBy] = useState(null);
  const [auto, setAuto] = useState(status === 'live');

  useEffect(() => {
    if (status !== 'live') return;
    const load = () => api.get(`/api/contests/${contestId}/standings`).then((r) => setRows(r.rows)).catch(() => {});
    let iv = auto ? setInterval(load, 5000) : null;
    const off = on('standings_changed', () => { if (auto) load(); });
    return () => { clearInterval(iv); off(); };
  }, [status, auto, contestId, on]);

  useEffect(() => {
    api.get(`/api/contests/${contestId}/standings`).then((r) => {
      setRows(r.rows);
      if (r.ratings?.length) {
        const m = new Map();
        for (const x of r.ratings) m.set(x.user_id, x);
        setRatingsBy(m);
      }
    }).catch(() => {});
  }, [contestId, status]);
  const ratings = !!ratingsBy;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <CardHead title={status === 'finished' ? 'Final standings' : 'Live standings'}
        kicker={status === 'live' ? 'solves → penalty → earliest AC' : 'rated result'}
        right={status === 'live' ? (
          <button className="chip" onClick={() => setAuto(!auto)}>{auto ? '● auto-refresh' : '○ paused'}</button>
        ) : null} />
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th><th>Developer</th><th>College</th>
            <th className="r">Solved</th><th className="r">Penalty</th>
            {data.problems.map((p) => <th key={p.id} className="cell-ac" title={p.title}>{p.label}</th>)}
            {ratings && status === 'finished' && <th className="r">Δ Rating</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8}><div className="empty">Empty board. First blood is unclaimed.</div></td></tr>}
          {rows.map((r) => (
            <tr key={r.user_id} style={user?.id === r.user_id ? { background: 'rgba(124,140,255,.06)' } : undefined}>
              <td className={'mono rank-' + r.place}>{r.place}</td>
              <td>
                <span className="row" style={{ gap: 8 }}>
                  <Avatar handle={r.handle} size={18} />
                  <Link to={'/u/' + r.handle} style={{ fontWeight: 650 }}>{r.handle}</Link>
                  <span className="dim tiny">{r.name}</span>
                </span>
              </td>
              <td className="small dim">{r.college || '—'}</td>
              <td className="r mono" style={{ fontWeight: 700 }}>{r.solved}</td>
              <td className="r mono dim">{r.penalty}</td>
              {r.cells.map((cell, i) => (
                <td key={i} className="cell-ac">
                  {cell.ac
                    ? <span className="dot"><span className="ok">+{cell.time}</span><span className="att">/{cell.fails}</span></span>
                    : cell.tried ? <span className="att">−{cell.fails}</span> : <span className="dim2">·</span>}
                </td>
              ))}
              {ratings && status === 'finished' && (
                <td className="r mono small" style={{ color: (ratingsBy.get(r.user_id)?.delta ?? 0) >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                  {ratingsBy.has(r.user_id) ? (ratingsBy.get(r.user_id).delta >= 0 ? '+' : '') + ratingsBy.get(r.user_id).delta : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useMemo } from 'react';
function MarkdownLite({ text }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = useMemo(() => {
    return String(text || '').split(/\n{2,}/).map((blk) => {
      const h = blk.match(/^(#{1,3})\s+(.*)/);
      if (h) return `<h3>${esc(h[2])}</h3>`;
      return `<p>${esc(blk).replace(/\n/g, '<br/>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')}</p>`;
    }).join('');
  }, [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
