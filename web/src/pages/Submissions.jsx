import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { Verdict } from '../components/ui.jsx';
import { Avatar } from '../components/Nav.jsx';

/* The arena feed — real submissions streaming as the judge rules on them. */
export function Submissions() {
  const { on, status } = useApp();
  const [items, setItems] = useState(null);
  const [live, setLive] = useState(true);

  const load = () => api.get('/api/submissions?limit=60').then((r) => setItems(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const offs = ['submission', 'submission_queued'].map((ev) => on(ev, () => { if (live) load(); }));
    const iv = setInterval(() => { if (live) load(); }, 8000);
    return () => { offs.forEach((f) => f()); clearInterval(iv); };
  }, [on, live]); // eslint-disable-line

  return (
    <div className="container" style={{ paddingTop: 46, paddingBottom: 40, maxWidth: 900 }}>
      <div className="spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Live feed</p>
          <h1 style={{ fontSize: 30, letterSpacing: '-.03em', margin: '4px 0' }}>Arena activity</h1>
          <p className="dim small">{status ? `${status.submissions_last_hour} submissions in the last hour · queue depth ${status.queue_depth}` : 'syncing with the judge…'}</p>
        </div>
        <button className={'chip' + (live ? ' active' : '')} onClick={() => setLive(!live)}>
          {live ? '● streaming' : '○ paused'}
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {!items && Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 46, margin: 12, borderRadius: 10 }} />)}
        {items?.map((s, i) => (
          <div key={s.id} className="row" style={{
            gap: 14, padding: '11px 18px', borderBottom: '1px solid var(--line)',
            animation: i === 0 ? 'pe .5s ease' : undefined, justifyContent: 'space-between',
          }}>
            <span className="row" style={{ gap: 10, minWidth: 0 }}>
              <Avatar handle={s.handle} size={22} />
              <Link to={'/u/' + s.handle} style={{ fontWeight: 650, flex: 'none' }}>{s.handle}</Link>
              <span className="dim2">→</span>
              <Link to={'/problems/' + s.problem_id} className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title || s.problem_id}
                <span className="dim2"> · {s.problem_id}</span>
              </Link>
              <span className="chip tiny mono" style={{ flex: 'none' }}>{s.lang}</span>
              {s.contest_id && <span className="chip tiny mono" style={{ color: 'var(--accent-2)', borderColor: 'rgba(55,226,197,.3)', flex: 'none' }}>{s.contest_id}</span>}
            </span>
            <span className="row" style={{ gap: 12, flex: 'none' }}>
              <span className="small mono dim2">{s.status === 'accepted' ? `${s.time_ms}ms · ` : ''}{s.passed}/{s.total}</span>
              <Verdict status={s.status} />
              <span className="small dim2" style={{ width: 64, textAlign: 'right' }}>{fmt.ago(s.created_at)}</span>
            </span>
          </div>
        ))}
        {items?.length === 0 && <div className="empty">The feed is quiet. Submit something.</div>}
      </div>
    </div>
  );
}
