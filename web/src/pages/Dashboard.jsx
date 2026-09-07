import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { Verdict } from '../components/ui.jsx';
import { Avatar } from '../components/Nav.jsx';

export function Dashboard() {
  const { user, toast, on, status } = useApp();
  const [d, setD] = useState(null);

  const load = () => api.get('/api/me/dashboard').then(setD).catch((e) => toast(e.message, 'err'));
  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line
  useEffect(() => {
    if (!user) return;
    const offs = [on('submission', (s) => { if (s.user === user.id) load(); }), on('standings_changed', load)];
    return () => offs.forEach((f) => f());
  }, [user, on]); // eslint-disable-line

  if (!user) return <Locked text="Sign in to see your arena dashboard." />;
  if (!d) return <div className="container section" style={{ display: 'grid', gap: 14 }}><div className="skeleton" style={{ height: 140 }} /><div className="skeleton" style={{ height: 320 }} /></div>;

  const live = d.contests.filter((c) => c.status === 'live');
  const next = d.contests.filter((c) => c.status === 'upcoming').sort((a, b) => a.start_at - b.start_at)[0];

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="spread" style={{ marginBottom: 22 }}>
        <div>
          <p className="eyebrow">Command deck</p>
          <h1 style={{ fontSize: 30, letterSpacing: '-.03em', margin: '4px 0 2px' }}>Welcome back, {user.handle}</h1>
          <p className="dim small">{d.pending > 0 ? `${d.pending} submission${d.pending > 1 ? 's' : ''} in flight · ` : ''}rating {user.rating} · {d.accepted_solved} accepted</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {live.length > 0 ? <Link className="btn btn-primary" to={'/contests/' + live[0].id}>Enter live contest</Link>
            : <Link className="btn btn-primary" to="/problems">Practice</Link>}
          <Link className="btn" to={'/u/' + user.handle}>Public profile</Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(280px,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="spread" style={{ padding: '15px 20px 0' }}>
              <h3 style={{ fontSize: 15 }}>Recent submissions</h3>
              <Link to="/submissions" className="small" style={{ color: 'var(--accent)' }}>live feed →</Link>
            </div>
            {d.submissions.length === 0 ? (
              <div className="empty">
                <p className="dim small">No runs yet. The arena starts with a first Accepted verdict.</p>
                <Link to="/problems/a-plus-b" className="btn btn-sm btn-primary" style={{ marginTop: 10 }}>Try the warmup →</Link>
              </div>
            ) : (
              <table className="tbl" style={{ marginTop: 10 }}>
                <tbody>
                  {d.submissions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ width: 120 }}><Link to={'/problems/' + s.problem_id} className="small" style={{ fontWeight: 600 }}>{s.title}</Link>
                        <div className="tiny dim2"><Diff s={s.difficulty} /> {s.contest_id ? `· ${s.contest_id}` : ''}</div></td>
                      <td><Verdict status={s.status} /></td>
                      <td className="small mono dim">{s.time_ms ? s.time_ms + 'ms' : ''}</td>
                      <td className="small mono dim2">{s.lang}</td>
                      <td className="r small dim2">{fmt.ago(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card pad">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Your contests</h3>
            <div className="stack" style={{ gap: 8 }}>
              {d.contests.slice(0, 5).map((c) => (
                <Link key={c.id} to={'/contests/' + c.id} className="panel-line row" style={{ padding: '10px 14px', gap: 12, justifyContent: 'space-between' }}>
                  <span className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className={'tag-status c-' + c.status} style={{ width: 78, flex: 'none' }}>{c.status}</span>
                    <b className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</b>
                  </span>
                  <span className="small dim2 mono" style={{ flex: 'none' }}>{c.my_registered ? '✓ in' : 'not registered'} · {fmt.day(c.start_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {live.length > 0 ? (
            <div className="card pad" style={{ borderColor: 'rgba(61,220,151,.3)' }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}><span className="livedot" /><span className="tiny mono" style={{ color: 'var(--ok)' }}>LIVE RIGHT NOW</span></div>
              <h3 style={{ fontSize: 16.5, marginBottom: 4 }}>{live[0].title}</h3>
              <p className="dim small" style={{ marginBottom: 12 }}>Ends {fmt.clock(Math.max(0, live[0].end_at - (status?.server_time || Date.now())))} remaining (server clock).</p>
              <Link to={'/contests/' + live[0].id} className="btn btn-primary" style={{ width: '100%' }}>Jump in →</Link>
            </div>
          ) : next ? (
            <div className="card pad">
              <div className="tiny mono dim2" style={{ marginBottom: 6 }}>NEXT ROUND</div>
              <h3 style={{ fontSize: 16.5, marginBottom: 4 }}>{next.title}</h3>
              <p className="dim small" style={{ marginBottom: 12 }}>{fmt.date(next.start_at)} · {fmt.dur(next.duration_ms)}</p>
              <Link to={'/contests/' + next.id} className="btn" style={{ width: '100%' }}>{next.my_registered ? 'Registered — details' : 'Register'}</Link>
            </div>
          ) : (
            <div className="card pad dim small">No contest on deck. Practice mode it is.</div>
          )}

          <div className="card pad">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Achievements</h3>
            <div className="grid" style={{ gap: 8, gridTemplateColumns: '1fr' }}>
              {d.achievements.length === 0 && <p className="dim small">None yet — first Accepted verdict unlocks <b>First Blood</b>.</p>}
              {d.achievements.map((a) => (
                <div key={a.id} className="ach gold"><span className="n">◆ {a.name}</span><span className="d">{a.description} · {fmt.day(a.earned_at)}</span></div>
              ))}
            </div>
          </div>

          <div className="card pad" style={{ textAlign: 'center' }}>
            <div className="tiny mono dim2">COLLEGE</div>
            {user.college
              ? <p style={{ marginTop: 6 }}><b>{user.college}</b><br /><Link className="small" to="/rankings?tab=colleges" style={{ color: 'var(--accent)' }}>see where you both stand →</Link></p>
              : <CollegePicker onSaved={load} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CollegePicker({ onSaved }) {
  const { colleges } = useApp();
  const [sel, setSel] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="stack" style={{ gap: 8, marginTop: 8 }}>
      <select className="input" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Choose college">
        <option value="">Pick your college…</option>
        {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        <option value="__new">+ Not in list — add it</option>
      </select>
      {sel === '__new' && <input className="input" placeholder="Full college name" value={name} onChange={(e) => setName(e.target.value)} />}
      <button className="btn btn-sm btn-primary" onClick={async () => {
        try {
          if (sel === '__new') await api.post('/api/auth/college', { name });
          else if (sel) await api.post('/api/auth/college', { name: colleges.find((c) => c.id === sel)?.name || '' });
          onSaved?.();
        } catch { /* no-op */ }
      }}>Save</button>
      <p className="tiny dim2">Your college powers the Belong board.</p>
    </div>
  );
}

const Diff = ({ s }) => <span className={'diff diff-' + s}>{s}</span>;
function Locked({ text }) {
  return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <h2 className="sect" style={{ marginBottom: 10 }}>Locked gate</h2>
      <p className="dim" style={{ marginBottom: 18 }}>{text}</p>
      <Link className="btn btn-primary" to="/auth/login">Sign in</Link>
    </div>
  );
}
