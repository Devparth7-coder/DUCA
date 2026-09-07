import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { CardHead } from '../components/ui.jsx';

/* Organizer console: real queue telemetry + contest/problem authoring for staff. */
export function Ops() {
  const { user, toast } = useApp();
  const [ctx, setCtx] = useState(null);
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('contests');
  const [json, setJson] = useState(SAMPLE_CONTEST);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (user?.role !== 'admin') return;
    api.get('/api/admin/context').then(setCtx).catch((e) => toast(e.message, 'err'));
    api.get('/api/system/status').then(setStatus).catch(() => {});
  };
  useEffect(load, [user]); // eslint-disable-line
  useEffect(() => { const iv = setInterval(load, 6000); return () => clearInterval(iv); }, [user]); // eslint-disable-line

  if (user?.role !== 'admin') return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <h2 className="sect">Ops is staff-only.</h2>
      <p className="dim small" style={{ margin: '8px 0 16px' }}>Sign in with an organizer account (demo: <b className="mono">vansh / arena-demo</b>).</p>
      <Link className="btn btn-primary" to="/auth/login">Switch account</Link>
    </div>
  );

  async function create() {
    setBusy(true);
    try {
      const payload = JSON.parse(json);
      const path = tab === 'contests' ? '/api/admin/contests' : '/api/admin/problems';
      await api.post(path, payload);
      toast('Created. The arena now references it.');
      load();
    } catch (e) { toast(e.message.startsWith('Unexpected') ? 'invalid JSON' : e.message, 'err'); }
    setBusy(false);
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="spread" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">Staff</p>
          <h1 style={{ fontSize: 30, letterSpacing: '-.03em', margin: '4px 0' }}>Arena Ops</h1>
        </div>
        <span className="chip mono tiny">{status ? `queue ${status.queue_depth}/${status.judge_slots} slots` : 'syncing'}</span>
      </div>

      <div className="hero-stats" style={{ marginTop: 0, marginBottom: 20 }}>
        {[
          ['live contests', status?.contests.live], ['upcoming', status?.contests.upcoming],
          ['completed', status?.contests.completed], ['problems', status?.problems_available],
          ['members', status?.members], ['queue depth', status?.queue_depth],
          ['accepted today', status?.accepted_today],
        ].map(([l, v]) => <div className="cell" key={l}><div className="num">{v ?? '—'}</div><div className="lbl">{l}</div></div>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="result-tabs" style={{ padding: '12px 14px 0' }}>
            {[['contests', 'New contest'], ['problems', 'New problem']].map(([k, l]) => (
              <button key={k} className={'result-tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); setJson(k === 'contests' ? SAMPLE_CONTEST : SAMPLE_PROBLEM); }}>{l}</button>
            ))}
            <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto', marginBottom: 6 }} disabled={busy} onClick={create}>{busy ? '…' : 'Create →'}</button>
          </div>
          <p className="tiny dim2" style={{ padding: '10px 16px 0' }}>
            JSON is validated server-side. Contest timing uses epoch ms — pick times relative to server clock
            ({status ? fmt.date(status.server_time) : '…'}). Problem tests: {"{ input, output, hidden }"}.
          </p>
          <textarea className="mono" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)}
            style={{ width: '100%', minHeight: 380, background: '#0a0c11', color: '#d7dcea', border: '0', borderTop: '1px solid var(--line)', padding: 16, fontSize: 12.5, lineHeight: 1.6, marginTop: 10, resize: 'vertical' }} />
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <CardHead title="Judge runtime" kicker="probed at boot — what the sandbox can actually run" />
            <div style={{ padding: 14, display: 'grid', gap: 8 }}>
              {ctx ? Object.entries(ctx.caps?.languages || {}).map(([k, v]) => (
                <div key={k} className="row spread mono small" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 7 }}>
                  <span>{k}</span>
                  <span style={{ color: v.ok ? 'var(--ok)' : 'var(--bad)' }}>{v.ok ? v.version || 'ready' : 'unavailable'}</span>
                </div>
              )) : <div className="skeleton" style={{ height: 90 }} />}
              <div className="tiny dim">Supervisor: python3 · rlimits: CPU, AS, FSIZE=0, CORE=0 · wall watchdog on the API side.</div>
            </div>
          </div>
          <div className="card pad">
            <div className="spread"><h3 style={{ fontSize: 14 }}>Server clock</h3><span className="mono small" style={{ color: 'var(--accent-2)' }}>{status ? fmt.date(status.server_time) : '—'}</span></div>
            <p className="tiny dim2 mono" style={{ marginTop: 8 }}>median accepted run: {status?.median_run_ms != null ? status.median_run_ms + 'ms' : 'no data'} · last activity: {status?.last_activity ? fmt.ago(status.last_activity) : '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const SAMPLE_CONTEST = JSON.stringify({
  id: 'sprint-weekend',
  title: 'Weekend Sprint',
  subtitle: 'Three hours, four problems, rated.',
  description: 'A sprint round for the weekend crowd.',
  rules: 'ICPC scoring. 20 minute penalty per wrong attempt.',
  start_at: Date.now() + 2 * 86400000,
  end_at: Date.now() + 2 * 86400000 + 3 * 3600000,
  penalty_min: 20,
  rated: true,
  problems: ['a-plus-b', 'lonely-bit', 'power-mod', 'island-steps'],
}, null, 2);

const SAMPLE_PROBLEM = JSON.stringify({
  id: 'double-it',
  title: 'Double It',
  difficulty: 'Easy',
  tags: ['implementation', 'math'],
  statement: 'Read one integer `x` and print `2*x`.',
  input_format: 'One line: integer x (|x| <= 1e9).',
  output_format: 'One line: 2*x.',
  constraints: 'Time limit: 1.0 s',
  examples: [{ input: '21\n', output: '42\n' }],
  tests: [{ input: '21\n', output: '42\n', hidden: false }, { input: '0\n', output: '0\n', hidden: true }, { input: '-3\n', output: '-6\n', hidden: true }],
  tl_ms: 1000, ml_mb: 256,
}, null, 2);
