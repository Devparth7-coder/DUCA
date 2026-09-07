import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { DiffTag } from '../components/ui.jsx';

const DIFFS = ['Easy', 'Medium', 'Hard', 'Insane'];

export function Problems() {
  const { user, toast } = useApp();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [diff, setDiff] = useState([]);
  const [tag, setTag] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set('search', q);
    if (diff.length) p.set('diff', diff.join(','));
    api.get('/api/problems?' + p).then((r) => setItems(r.items)).catch((e) => toast(e.message, 'err'));
  }, [q, diff.join(',')]); // eslint-disable-line

  const tags = useMemo(() => [...new Set((items || []).flatMap((i) => i.tags))].sort(), [items]);
  const shown = (items || []).filter((i) => !tag || i.tags.includes(tag));
  const solvedCount = (items || []).filter((i) => i.solved).length;

  return (
    <div className="container section" style={{ paddingTop: 46 }}>
      <div className="spread" style={{ marginBottom: 22 }}>
        <div>
          <p className="eyebrow">Practice</p>
          <h1 style={{ fontSize: 34, letterSpacing: '-.03em', marginTop: 6 }}>Problem Set</h1>
          <p className="dim small">{user ? `${solvedCount}/${items?.length ?? 0} solved by you · ` : ''}verdicts come from the sandboxed judge — timings are measured, not mocked.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ width: 220 }} placeholder="Search problems…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search problems" />
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {DIFFS.map((d) => (
          <button key={d} className={'chip' + (diff.includes(d) ? ' active' : '')}
            onClick={() => setDiff((s) => s.includes(d) ? s.filter((x) => x !== d) : [...s, d])}>{d}</button>
        ))}
        {diff.length > 0 && <button className="chip" onClick={() => setDiff([])}>clear ×</button>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {tags.map((t) => (
          <button key={t} className={'chip' + (tag === t ? ' active' : '')} onClick={() => setTag(tag === t ? null : t)}>{t}</button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th style={{ width: 34 }} /><th>Problem</th><th>Difficulty</th><th>Acceptance</th><th>Solvers</th></tr>
          </thead>
          <tbody>
            {!items && Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 22 }} /></td></tr>)}
            {shown?.map((p) => (
              <tr key={p.id}>
                <td>{p.solved ? <span title="solved by you" style={{ color: 'var(--ok)' }}>✓</span> : <span className="dim2">·</span>}</td>
                <td>
                  <Link to={'/problems/' + p.id} style={{ fontWeight: 650 }}>{p.title}</Link>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    {p.tags.map((t) => <span key={t} className="chip tiny" style={{ padding: '1px 8px' }}>{t}</span>)}
                  </div>
                </td>
                <td><DiffTag d={p.difficulty} /></td>
                <td className="mono small">
                  {p.stats.attempts ? <span className={p.stats.accepted / p.stats.attempts > 0.5 ? '' : 'dim'}>
                    {Math.round((p.stats.accepted / Math.max(1, p.stats.attempts)) * 100)}%</span> : <span className="dim2">no runs yet</span>}
                  <span className="dim2"> · {p.stats.attempts} attempts</span>
                </td>
                <td className="mono small dim">{p.stats.solvers || '—'}</td>
              </tr>
            ))}
            {items && shown.length === 0 && <tr><td colSpan={5}><div className="empty">No problems match this filter.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
