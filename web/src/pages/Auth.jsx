import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Link, useRouter } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { Logo } from '../App.jsx';

export function Auth({ mode }) {
  const [tab, setTab] = useState(mode);
  const { nav } = useRouter();
  const { setUser, toast, colleges, refreshUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ login: '', password: '', handle: '', name: '', email: '', college: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => setTab(mode), [mode]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'login') {
        const r = await api.post('/api/auth/login', { login: form.login, password: form.password });
        setUser(r.user); toast(`Welcome back, ${r.user.handle}.`); nav('/me');
      } else {
        const r = await api.post('/api/auth/register', {
          handle: form.handle, name: form.name, email: form.email, password: form.password, college_id: form.college || undefined,
        });
        setUser(r.user); toast('Account live. The board is waiting.'); nav('/me');
      }
    } catch (err) { toast(err.message, 'err'); }
    setBusy(false);
  }

  const demo = () => setForm((f) => ({ ...f, login: 'aarav', password: 'arena-demo', }));

  return (
    <div className="container section auth-wrap" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 40, alignItems: 'center', minHeight: '72vh' }}>
      <div style={{ display: 'none' }} className="auth-art-only" />
      <div>
        <div className="brand" style={{ marginBottom: 26 }}>
          <Logo size={40} />
          <div className="brand-word"><b style={{ fontSize: 18 }}>DEVUNITY CODEARENA</b><span>Compete · Build · Improve · Belong</span></div>
        </div>
        <h2 className="sect" style={{ marginBottom: 10 }}>
          {tab === 'login' ? 'The arena kept your seat warm.' : 'Register once. Compete forever.'}
        </h2>
        <p className="dim small" style={{ maxWidth: 380, marginBottom: 22 }}>
          Sessions are HttpOnly cookies; passwords are scrypt-hashed; the judge never runs code inside this
          server. Security posture, in the boring terms.
        </p>
        <div className="panel-line pad" style={{ padding: 14, display: 'grid', gap: 4, maxWidth: 380 }}>
          <div className="tiny mono" style={{ color: 'var(--ink-2)' }}>DEMO ARENA · {colleges?.length || 10} COLLEGES · 12 MEMBERS</div>
          <div className="small dim">Sign in with <b className="mono">aarav</b> / <b className="mono">arena-demo</b> as a member, or <b className="mono">vansh</b> for staff access (Ops console).</div>
          <button type="button" className="btn btn-sm btn-ghost" style={{ width: 'fit-content', marginTop: 6 }} onClick={demo}>Fill demo credentials</button>
        </div>
      </div>

      <form className="card pad" style={{ padding: 30, display: 'grid', gap: 14 }} onSubmit={submit}>
        <div className="row" style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 4, marginBottom: 6 }}>
          {[['login', 'Sign in'], ['register', 'Create account']].map(([k, l]) => (
            <button type="button" key={k} onClick={() => setTab(k)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 0, fontWeight: 650, fontSize: 13.5,
                background: tab === k ? 'rgba(255,255,255,.09)' : 'transparent', color: tab === k ? 'var(--ink)' : 'var(--ink-3)' }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'login' ? (
          <>
            <label className="field">Username or email
              <input className="input" value={form.login} onChange={set('login')} autoComplete="username" required autoFocus />
            </label>
            <label className="field">Password
              <input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="current-password" required />
            </label>
          </>
        ) : (
          <>
            <label className="field">Handle — public, on every leaderboard
              <input className="input mono" value={form.handle} onChange={set('handle')} pattern="[a-zA-Z0-9._-]{2,20}" required placeholder="you.dev" />
            </label>
            <label className="field">Display name
              <input className="input" value={form.name} onChange={set('name')} required placeholder="Yuvika Sharma" />
            </label>
            <label className="field">Email
              <input className="input" type="email" value={form.email} onChange={set('email')} required placeholder="you@college.edu" />
            </label>
            <label className="field">College
              <select className="input" value={form.college} onChange={set('college')}>
                <option value="">Represent nobody (for now)</option>
                {(colleges || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">Password — min 8 chars
              <input className="input" type="password" value={form.password} onChange={set('password')} minLength={8} required autoComplete="new-password" />
            </label>
          </>
        )}

        <button className="btn btn-primary btn-lg" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? 'One moment…' : tab === 'login' ? 'Enter the arena' : 'Create account & enter'}
        </button>
        <p className="tiny dim2" style={{ textAlign: 'center' }}>By entering you agree to be gracious in victory and curious in defeat.</p>
      </form>
    </div>
  );
}
