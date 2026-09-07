import { RouterProvider, useRouter, Link } from './lib/router.jsx';
import { AppProvider, useApp } from './store.jsx';
import { Nav } from './components/Nav.jsx';
import { Home } from './pages/Home.jsx';
import { Contests } from './pages/Contests.jsx';
import { ContestDetail } from './pages/ContestDetail.jsx';
import { Problems } from './pages/Problems.jsx';
import { ProblemDetail } from './pages/ProblemDetail.jsx';
import { Leaderboard } from './pages/Leaderboard.jsx';
import { Profile } from './pages/Profile.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Submissions } from './pages/Submissions.jsx';
import { Auth } from './pages/Auth.jsx';
import { Ops } from './pages/Ops.jsx';

function Routes() {
  const { path } = useRouter();
  const seg = path.split('/').filter(Boolean);
  let page;
  if (seg.length === 0) page = <Home />;
  else if (seg[0] === 'contests' && seg[1]) page = <ContestDetail id={seg[1]} />;
  else if (seg[0] === 'contests') page = <Contests />;
  else if (seg[0] === 'problems' && seg[1]) page = <ProblemDetail id={seg[1]} contest={seg[2] ? { id: seg[2] } : null} />;
  else if (seg[0] === 'problems') page = <Problems />;
  else if (seg[0] === 'rankings') page = <Leaderboard />;
  else if (seg[0] === 'u') page = <Profile handle={seg[1]} />;
  else if (seg[0] === 'me') page = <Dashboard />;
  else if (seg[0] === 'submissions') page = <Submissions />;
  else if (seg[0] === 'auth') page = <Auth mode={seg[1] === 'register' ? 'register' : 'login'} />;
  else if (seg[0] === 'ops') page = <Ops />;
  else page = <NotFound />;

  return <div className="page-enter" key={path}>{page}</div>;
}

function NotFound() {
  return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <div className="bignum" style={{ fontSize: 72 }}>404</div>
      <p className="dim">This corner of the arena is undocumented.</p>
      <Link className="btn btn-primary" to="/" style={{ marginTop: 16 }}>Return to base</Link>
    </div>
  );
}

export function App() {
  return (
    <RouterProvider>
      <AppProvider>
        <div className="atmosphere" /><div className="grain" />
        <Nav />
        <main><Routes /></main>
        <Footer />
      </AppProvider>
    </RouterProvider>
  );
}

function Footer() {
  return (
    <footer className="site">
      <div className="container" style={{ display: 'grid', gap: 26 }}>
        <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 30 }}>
          <div style={{ maxWidth: 380 }}>
            <div className="brand" style={{ marginBottom: 10 }}>
              <Logo size={26} />
              <div className="brand-word"><b>DEVUNITY CODEARENA</b><span>Compete · Build · Improve · Belong</span></div>
            </div>
            <p className="small">Built by students, for developers. Submissions judged in an isolated sandbox — verdicts are measurements, never decoration.</p>
          </div>
          <div className="footer-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 36 }}>
            <div className="stack" style={{ gap: 8 }}>
              <div className="tiny" style={{ color: 'var(--ink-2)', fontWeight: 700 }}>Arena</div>
              <Link to="/contests">Contests</Link><Link to="/problems">Problems</Link>
              <Link to="/rankings">Rankings</Link><Link to="/submissions">Live feed</Link>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <div className="tiny" style={{ color: 'var(--ink-2)', fontWeight: 700 }}>You</div>
              <Link to="/me">Dashboard</Link><Link to="/auth/login">Sign in</Link><Link to="/auth/register">Create account</Link>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <div className="tiny" style={{ color: 'var(--ink-2)', fontWeight: 700 }}>Platform</div>
              <Link to="/ops">System</Link><a href="/api/system/status" target="_blank" rel="noreferrer">Status API</a>
            </div>
          </div>
        </div>
        <hr className="hairline" />
        <div className="spread small mono" style={{ color: 'var(--ink-3)' }}>
          <span>© {new Date().getFullYear()} DevUnity Tech Club</span>
          <span id="footer-clock" />
        </div>
      </div>
    </footer>
  );
}

export function Logo({ size = 30 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c8cff" /><stop offset="1" stopColor="#37e2c5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0a0c12" stroke="rgba(255,255,255,.08)" />
      <path d="M16 12h16a20 20 0 0 1 0 40H16V12Z" fill="none" stroke="url(#lg-mark)" strokeWidth="5" strokeLinejoin="round" />
      <rect x="24" y="24" width="15" height="15" rx="3" fill="url(#lg-mark)" transform="rotate(45 31.5 31.5)" />
    </svg>
  );
}
