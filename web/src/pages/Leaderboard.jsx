import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import { Link, useRouter } from '../lib/router.jsx';
import { Rating } from '../components/ui.jsx';
import { Avatar } from '../components/Nav.jsx';
import { useApp } from '../store.jsx';

export function Leaderboard() {
  const { user } = useApp();
  const { path } = useRouter();
  const tabFromUrl = new URLSearchParams(location.search).get('tab') || 'global';
  const [tab, setTab] = useState(tabFromUrl);
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    if (tab === 'global') {
      api.get('/api/leaderboard?limit=250').then((r) => setRows(r.items)).catch(() => setRows([]));
      if (user) api.get('/api/leaderboard?limit=500').then((r) => {
        const me = (r.items || []).find((x) => x.id === user.id);
        if (me) setMyRank({ rank: r.items.indexOf(me) + 1, rating: me.rating });
      }).catch(() => {});
    } else {
      api.get('/api/leaderboard/colleges').then((r) => setRows(r.rows)).catch(() => setRows([]));
    }
  }, [tab, user]);

  return (
    <div className="container" style={{ paddingTop: 46, paddingBottom: 40 }}>
      <p className="eyebrow">Rankings</p>
      <div className="spread" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 34, letterSpacing: '-.03em', margin: '6px 0 4px' }}>The Board</h1>
          <p className="dim small">Ratings update when a contest closes, from real placement data. No vanity metrics — every number is a query.</p>
        </div>
        <input className="input" style={{ width: 200 }} placeholder="Find a developer…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {['global', 'colleges'].map((t) => (
          <button key={t} className={'chip' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
            {t === 'global' ? 'Developers' : 'Colleges'}
          </button>
        ))}
        {myRank && tab === 'global' && (
          <span className="chip mono tiny" style={{ marginLeft: 'auto', color: 'var(--accent)' }}>you are #{myRank.rank} · {myRank.rating}</span>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {tab === 'global' ? <Global rows={rows} q={q} /> : <Colleges rows={rows} q={q} />}
      </div>
    </div>
  );
}

function Global({ rows, q }) {
  const list = (rows || []).filter((r) => !q || r.handle.toLowerCase().includes(q.toLowerCase()) || (r.name || '').toLowerCase().includes(q.toLowerCase()));
  if (!rows) return <div className="empty">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 34, marginBottom: 8 }} />)}</div>;
  return (
    <table className="tbl">
      <thead><tr><th style={{ width: 44 }}>#</th><th>Developer</th><th>College</th><th className="r">Rating</th><th className="r">Peak</th><th className="r">Solved</th></tr></thead>
      <tbody>
        {list.map((r, i) => (
          <tr key={r.id}>
            <td className={'mono rank-' + (i + 1)}>{i + 1}</td>
            <td>
              <Link to={'/u/' + r.handle} className="row" style={{ gap: 9 }}>
                <Avatar handle={r.handle} size={20} />
                <b style={{ fontWeight: 650 }}>{r.handle}</b>
                <span className="dim small">{r.name}</span>
              </Link>
            </td>
            <td className="small dim">{r.college || <span className="dim2">—</span>}</td>
            <td className="r"><Rating value={r.rating} /></td>
            <td className="r mono small dim">{r.peak}</td>
            <td className="r mono small">{r.solved}</td>
          </tr>
        ))}
        {list.length === 0 && <tr><td colSpan={6}><div className="empty">No matches.</div></td></tr>}
      </tbody>
    </table>
  );
}

function Colleges({ rows, q }) {
  const list = (rows || []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  if (!rows) return <div className="empty">…</div>;
  return (
    <table className="tbl">
      <thead><tr><th style={{ width: 44 }}>#</th><th>College</th><th className="r">Members</th><th className="r">Best rating</th><th className="r">Avg top-5</th><th className="r">Accepted</th><th className="r">Score</th></tr></thead>
      <tbody>
        {list.map((r, i) => (
          <tr key={r.id}>
            <td className={'mono rank-' + (i + 1)}>{i + 1}</td>
            <td><b style={{ fontWeight: 650 }}>{r.name}</b> <span className="chip tiny mono">{r.code}</span> <span className="dim small">· {r.city}</span></td>
            <td className="r mono">{r.members}</td>
            <td className="r"><Rating value={r.best} /></td>
            <td className="r mono">{r.avg_top5}</td>
            <td className="r mono">{r.accepted}</td>
            <td className="r mono" style={{ fontWeight: 700, color: 'var(--accent-2)' }}>{fmt.num(r.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
