import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { Rating, Spark, Heat, Verdict, DiffTag } from '../components/ui.jsx';
import { useApp } from '../store.jsx';

const TIERS = [[2400, 'grandmaster'], [2100, 'master'], [1900, 'candidate master'], [1600, 'expert'], [1400, 'specialist'], [1200, 'pupil'], [0, 'newcomer']];
const tierOf = (r) => TIERS.find(([x]) => r >= x)[1];

export function Profile({ handle }) {
  const { user } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setD(null); setErr(null);
    api.get('/api/users/' + handle).then(setD).catch((e) => setErr(e));
  }, [handle]);

  if (err) return <div className="container section"><p className="dim">{err.message}</p><Link className="btn" to="/rankings">← rankings</Link></div>;
  if (!d) return <div className="container section" style={{ display: 'grid', gap: 14 }}><div className="skeleton" style={{ height: 160 }} /><div className="skeleton" style={{ height: 320 }} /></div>;

  const { u } = { u: d.user };
  const maxSolve = Math.max(...(d.solved.length ? [d.solved.length] : [1]));
  const diffAgg = new Map((d.by_difficulty || []).map((x) => [x.difficulty, x]));

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="card profile-head" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
        <div className="ring" style={{ width: 82, height: 82, borderRadius: 22 }}>{u.handle.slice(0, 2).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <h1 style={{ fontSize: 26, letterSpacing: '-.02em' }}>{u.handle}</h1>
            {u.role === 'admin' && <span className="chip tiny mono" style={{ borderColor: 'rgba(124,140,255,.4)', color: 'var(--accent)' }}>STAFF</span>}
          </div>
          <p className="dim small">{u.name}{u.college ? ` · ${u.college}` : ''} · joined {fmt.day(u.created_at)}</p>
        </div>
        <div className="stack" style={{ gap: 4, textAlign: 'right' }}>
          <div className="tiny mono dim2">RATING · {tierOf(u.rating).toUpperCase()}</div>
          <div style={{ fontSize: 30 }}><Rating value={u.rating} /></div>
          <div className="small dim2 mono">peak {u.peak} · {d.solved.length} problems</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="spread" style={{ padding: '15px 20px 0' }}>
              <h3 style={{ fontSize: 15 }}>Rating history</h3>
              <span className="tiny dim2 mono">published after each rated round</span>
            </div>
            <div style={{ padding: '14px 20px 18px' }}>
              <Spark points={d.rating_history.map((r) => ({ rating: r.new_rating, delta: r.delta }))} width={420} height={84} />
              {d.rating_history.length > 0 && (
                <table className="tbl" style={{ marginTop: 10 }}>
                  <tbody>
                    {d.rating_history.slice().reverse().slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="small">{r.contest_id}</td>
                        <td className="mono small dim">{fmt.day(r.computed_at)}</td>
                        <td className="r mono small">#{r.rank}</td>
                        <td className="r mono small" style={{ color: r.delta >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{r.delta >= 0 ? '+' : ''}{r.delta}</td>
                        <td className="r mono small dim2">{r.old_rating} → {r.new_rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="spread" style={{ padding: '15px 20px 0' }}>
              <h3 style={{ fontSize: 15 }}>Solved problems</h3>
              <span className="tiny dim2 mono">{d.solved.length} total</span>
            </div>
            <div style={{ padding: '12px 20px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 6 }}>
              {d.solved.length === 0 && <span className="dim small">Nothing accepted yet — the warmup problem is a good first blood.</span>}
              {d.solved.map((p) => (
                <Link key={p.id} to={'/problems/' + p.id} className="panel-line" style={{ padding: '8px 10px', display: 'grid', gap: 2, transition: 'border-color .15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--line-strong)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}>
                  <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.title}</span>
                  <span className="tiny mono"><DiffTag d={p.difficulty} /></span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="spread" style={{ padding: '15px 20px 0' }}>
              <h3 style={{ fontSize: 15 }}>Recent activity</h3>
              <span className="tiny dim2 mono">last {Math.min(15, d.recent.length)} runs</span>
            </div>
            <table className="tbl" style={{ marginTop: 8 }}>
              <tbody>
                {d.recent.map((s) => (
                  <tr key={s.id}>
                    <td className="small">{s.title} <span className="dim2">· {s.problem_id}</span></td>
                    <td><Verdict status={s.status} /></td>
                    <td className="small mono dim2">{s.lang}</td>
                    <td className="r small dim2">{fmt.ago(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card pad">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Submission rhythm <span className="dim2 tiny mono" style={{ fontWeight: 400 }}>· 25 weeks</span></h3>
            <Heat activity={d.activity} />
            <p className="tiny dim2 mono" style={{ marginTop: 10 }}>{(d.activity || []).reduce((a, x) => a + x.c, 0)} submissions recorded</p>
          </div>

          <div className="card pad">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>By difficulty</h3>
            {['Easy', 'Medium', 'Hard', 'Insane'].map((dt) => {
              const row = diffAgg.get(dt);
              const acc = row ? row.acc / Math.max(1, row.tries) : 0;
              return (
                <div key={dt} className="row" style={{ gap: 10, marginBottom: 8 }}>
                  <span className={'diff diff-' + dt} style={{ width: 62 }}>{dt.toUpperCase()}</span>
                  <div className="progress" style={{ flex: 1, height: 6 }}>
                    <div style={{ width: Math.round(acc * 100) + '%' }} />
                  </div>
                  <span className="mono tiny dim2" style={{ width: 72 }}>{row ? `${row.acc}/${row.tries}` : '—'}</span>
                </div>
              );
            })}
          </div>

          <div className="card pad">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Topics conquered</h3>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {d.tags.length === 0 && <span className="dim small">No solved topics yet.</span>}
              {d.tags.map((t) => <span key={t.t || t.tag} className="chip mono tiny">{t.t || t.tag} <b style={{ color: 'var(--ink)' }}>×{t.solved}</b></span>)}
            </div>
          </div>

          <div className="card pad">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Achievements <span className="dim2 tiny mono" style={{ fontWeight: 400 }}>{d.achievements.length} earned</span></h3>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {d.achievements.map((a) => (
                <div key={a.id} className="ach gold">
                  <span className="n">◆ {a.name}</span>
                  <span className="d">{a.description}</span>
                  <span className="tiny mono dim2">{fmt.day(a.earned_at)}</span>
                </div>
              ))}
              {d.achievements.length === 0 && <span className="dim small">Achievements unlock from records — first accepted verdict is the closest one.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
