import { useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { api } from '../lib/api.js';
import { Logo } from '../App.jsx';

const LINKS = [
  ['/contests', 'Contests'], ['/problems', 'Problems'],
  ['/rankings', 'Rankings'], ['/submissions', 'Feed'],
];

export function Nav() {
  const { path, nav } = useRouter();
  const { user, status, toast, setUser } = useApp();

  async function logout() {
    try { await api.post('/api/auth/logout', {}); setUser(null); toast('Signed out. The arena waits.'); nav('/'); } catch (e) { toast(e.message, 'err'); }
  }

  const onContest = path.startsWith('/contests') || path === '/';
  return (
    <header className="nav">
      <div className="container nav-in">
        <Link to="/" className="brand" aria-label="DevUnity CodeArena home">
          <Logo />
          <span className="brand-word"><b>DEVUNITY CODEARENA</b><span>Compete · Build · Improve · Belong</span></span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map(([to, label]) => <Link key={to} to={to} className={path.startsWith(to) ? 'on' : ''}>{label}</Link>)}
          {user && <Link to="/me" className={path.startsWith('/me') ? 'on' : ''}>Dashboard</Link>}
          {user?.role === 'admin' && <Link to="/ops" className={path.startsWith('/ops') ? 'on' : ''}>Ops</Link>}
        </nav>
        <div className="row" style={{ gap: 12 }}>
          <StatusLive status={status} />
          {user === undefined && <div className="skeleton" style={{ width: 150, height: 34 }} />}
          {user === null && (
            <>
              <Link to="/auth/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/auth/register" className="btn btn-primary btn-sm">Enter CodeArena</Link>
            </>
          )}
          {user && (
            <div className="row" style={{ gap: 10 }}>
              <span className="chip mono" title="rating"><b style={{ color: 'var(--ink)' }} className={'rt-' + ratingTier(user.rating)}>{user.rating}</b></span>
              <Link to={'/u/' + user.handle}><Avatar handle={user.handle} /></Link>
              <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function ratingTier(r) {
  if (r >= 2400) return 'gm'; if (r >= 2100) return 'master'; if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert'; if (r >= 1400) return 'specialist'; if (r >= 1200) return 'pupil';
  return 'new';
}

export function StatusLive({ status }) {
  if (!status) return <span className="chip tiny mono dim2" style={{ borderStyle: 'dashed' }}>● connecting…</span>;
  return (
    <span className="status-pill" title="Live platform indicator — every value is a live backend query">
      <span className="livedot" /> CODEARENA ONLINE
      <span style={{ color: 'var(--ink-2)', letterSpacing: '.02em' }}>
        {status.contests.live} live · {fmtN(status.online_users)} online · {fmtN(status.problems_available)} problems
      </span>
    </span>
  );
}
const fmtN = (v) => v == null ? '0' : Number(v).toLocaleString();

export function Avatar({ handle, size = 26 }) {
  const id = [...String(handle || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hue = id % 360, hue2 = (hue + 40) % 360;
  const cells = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 5; y++) {
    if ((id >> ((x * 5 + y) % 24) ^ (y * x + 1)) & 1) cells.push(<rect key={x + '-' + y} x={x * 2} y={y} width="2" height="1" fill={`hsl(${hue2 + ((x + y) * 23) % 60} 70% ${58 - ((x + y) % 3) * 8}%)`} />);
  }
  const cols = [...cells.slice(0), ...Array.from({ length: 0 })];
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 10 5" preserveAspectRatio="none" aria-hidden="true" style={{ border: '1px solid hsl(' + hue + ' 60% 40% / .45)', background: `linear-gradient(160deg, #0b0d13, hsl(${hue} 45% 12%))`, borderRadius: 8 }}>
      {cells}
    </svg>
  );
}
