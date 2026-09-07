import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { ContestStatus, Countdown, Reveal } from '../components/ui.jsx';

export function Contests() {
  const { status, toast } = useApp();
  const [items, setItems] = useState(null);

  useEffect(() => {
    const load = () => api.get('/api/contests').then((r) => setItems(r.items)).catch((e) => toast(e.message, 'err'));
    load();
    return () => {};
  }, [status?.contests, status?.server_time && Math.floor(status.server_time / 60000)]); // eslint-disable-line

  const live = (items || []).filter((c) => c.status === 'live');
  const upcoming = (items || []).filter((c) => c.status === 'upcoming');
  const past = (items || []).filter((c) => c.status === 'finished');

  return (
    <div className="container" style={{ paddingTop: 46, paddingBottom: 40 }}>
      <p className="eyebrow">Schedule</p>
      <h1 style={{ fontSize: 34, letterSpacing: '-.03em', margin: '6px 0 4px' }}>Contests</h1>
      <p className="dim small" style={{ maxWidth: 640 }}>
        Every clock here reads from the server — countdowns survive a wrong laptop clock. Registrations are
        instant; live standings recompute the moment a verdict lands.
      </p>

      <div className="stack" style={{ gap: 44, marginTop: 34 }}>
        {[['Happening now', live], ['Upcoming', upcoming],['Completed', past]].map(([label, list]) => (
          <section key={label}>
            <div className="spread" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, letterSpacing: '-.01em' }}>{label} <span className="dim2 mono" style={{ fontSize: 13 }}>({list.length})</span></h2>
            </div>
            {list.length === 0 && label !== 'Happening now' && <p className="dim small">Nothing in this lane yet.</p>}
            {list.length === 0 && label === 'Happening now' && (
              <div className="card pad dim small">The floor is quiet — no contest is live at this second. Upcoming rounds start on the schedule below.</div>
            )}
            <div className="grid" style={{ gap: 14 }}>
              {list.map((c, i) => (
                <Reveal key={c.id} delay={i * 60}>
                  <Link to={'/contests/' + c.id}>
                    <div className={'card hover pad' + (c.status === 'live' ? '' : '')} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                          <ContestStatus status={c.status} />
                          {c.rated && <span className="chip tiny">RATED</span>}
                          <span className="dim2 mono small">{c.id}</span>
                        </div>
                        <h3 style={{ fontSize: 18.5, letterSpacing: '-.02em' }}>{c.title}</h3>
                        <p className="dim small" style={{ margin: '4px 0 10px' }}>{c.subtitle}</p>
                        <div className="row mono small dim2" style={{ gap: 16, flexWrap: 'wrap' }}>
                          <span>{fmt.date(c.start_at)}</span>
                          <span>·</span><span>{fmt.dur(c.duration_ms)}</span>
                          <span>·</span><span>{c.problems} problems</span>
                          <span>·</span><span>{c.registered} registered</span>
                          {c.my_registered && <span className="chip tiny" style={{ color: 'var(--ok)', borderColor: 'rgba(61,220,151,.4)' }}>you're in</span>}
                        </div>
                      </div>
                      <div className="stack" style={{ gap: 8, alignItems: 'end' }}>
                        {c.status !== 'finished' && (
                          <Countdown target={c.status === 'live' ? c.end_at : c.start_at} prefix="" />
                        )}
                        <span className="btn btn-sm btn-ghost">{c.status === 'finished' ? 'View standings' : c.status === 'live' ? 'Enter arena →' : 'Register →'}</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
