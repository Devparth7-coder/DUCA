import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Link, useRouter } from '../lib/router.jsx';
import { useApp } from '../store.jsx';
import { Verdict, DiffTag, CardHead } from '../components/ui.jsx';

export function ProblemDetail({ id, contest }) {
  const { user, toast, on } = useApp();
  const { nav } = useRouter();
  const [data, setData] = useState(null);
  const [langs, setLangs] = useState([]);
  const [lang, setLang] = useState('python');
  const [code, setCode] = useState('');
  const [fontSize, setFontSize] = useState(13);
  const [busy, setBusy] = useState(null); // 'run' | 'submit'
  const [panel, setPanel] = useState(null); // {kind, …}
  const [tab, setTab] = useState('result');
  const subWatch = useRef(null);

  useEffect(() => {
    api.get('/api/problems/' + id).then((r) => {
      setData(r);
      const savedLang = localStorage.getItem(`ca:lang:${id}`) || 'python';
      setLang(savedLang);
      setCode(localStorage.getItem(`ca:code:${id}:${savedLang}`) || r.problem.starter?.[savedLang] || DEFAULTS[savedLang] || DEFAULTS.python);
    }).catch((e) => { toast(e.message, 'err'); if (e.status === 404) nav('/problems'); });
    api.get('/api/languages').then(setLangs).catch(() => {});
  }, [id]); // eslint-disable-line

  const ensureCode = useCallback((language) => {
    const saved = localStorage.getItem(`ca:code:${id}:${language}`);
    const base = saved || data?.problem.starter?.[language] || DEFAULTS[language] || DEFAULTS.python;
    return base;
  }, [id, data]);

  function changeLang(l) {
    localStorage.setItem(`ca:code:${id}:${lang}`, codeRef.current ?? code);
    localStorage.setItem(`ca:lang:${id}`, l);
    setLang(l);
    setCode(ensureCode(l));
    if (editorRef.current && monacoRef.current) {
      const old = editorRef.current.getModel();
      editorRef.current.setModel(monacoRef.current.editor.createModel(ensureCode(l), MONACO_LANG[l]));
      if (old) setTimeout(() => old.dispose(), 0);
    }
  }
  const codeRef = useRef(code);
  useEffect(() => { codeRef.current = code; }, [code]);
  const editorRef = useRef(null), monacoRef = useRef(null);

  /* ---- submission lifecycle: SSE first, poll as backup ---- */
  const trackSubmission = useCallback((sid, kind) => {
    setBusy(kind);
    setPanel({ kind, status: 'judging', id: sid });
    let done = false;
    const finalize = async () => {
      if (done) return; done = true;
      try {
        const r = await api.get('/api/submissions/' + sid);
        setPanel({ kind, ...r.submission, full: true });
        api.get('/api/problems/' + id).then(setData).catch(() => {});
      } catch (e) { toast(e.message, 'err'); }
      setBusy(null);
    };
    const off = on('submission', (d) => { if (d.id === sid) finalize(); });
    const iv = setInterval(async () => {
      try {
        const r = await api.get('/api/submissions/' + sid);
        if (!['queued', 'judging'].includes(r.submission.status)) finalize();
      } catch {}
    }, 1400);
    clearInterval(subWatch.current);
    subWatch.current = setTimeout(() => { clearInterval(iv); off(); }, 90000);
    return () => { clearInterval(iv); off(); };
  }, [id, on, toast]);

  // if we arrive with a pending contest/practice submission for me? (no-op hook)
  useEffect(() => () => { clearTimeout(subWatch.current); }, []);

  async function run() {
    if (!user) return needAuth();
    setBusy('run');
    setPanel({ kind: 'run', status: 'running' });
    try {
      const r = await api.post('/api/judge/run', { problem_id: id, language: lang, code: codeRef.current });
      setPanel({ kind: 'run', ...r, full: true });
      setTab('result');
    } catch (e) { toast(e.message, 'err'); setPanel(null); }
    setBusy(null);
  }
  async function submit() {
    if (!user) return needAuth();
    setBusy('submit');
    setPanel({ kind: 'submit', status: 'queued' });
    try {
      const r = await api.post('/api/judge/submit', { problem_id: id, language: lang, code: codeRef.current, contest_id: contest?.id });
      trackSubmission(r.id, 'submit');
    } catch (e) { toast(e.message, 'err'); setBusy(null); setPanel(null); }
  }
  function needAuth() {
    toast('Sign in to run and submit code', 'err');
    nav('/auth/login');
  }

  return (
    <div className="container" style={{ paddingTop: 26, paddingBottom: 60 }}>
      {data ? (
        <>
          <div className="row small dim" style={{ marginBottom: 14 }}>
            <Link to="/problems" style={{ color: 'var(--accent)' }}>Problems</Link>
            <span>/</span><span className="mono">{data.problem.id}</span>
            {contest && <><span>/</span><Link to={'/contests/' + contest.id} style={{ color: 'var(--accent-2)' }}>in {contest.id}</Link></>}
          </div>

          <div className="editor-shell" style={{ alignItems: 'stretch' }}>
            {/* ============ LEFT: statement ============ */}
            <div className="stack" style={{ gap: 18, minWidth: 0 }}>
              <div>
                <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                  <DiffTag d={data.problem.difficulty} />
                  {data.problem.tags.map((t) => <span key={t} className="chip tiny">{t}</span>)}
                  {data.solved && <span className="v v-accepted">SOLVED</span>}
                </div>
                <h1 style={{ fontSize: 30, letterSpacing: '-.03em', lineHeight: 1.15 }}>{data.problem.title}</h1>
                <div className="row dim small mono" style={{ gap: 16, marginTop: 8 }}>
                  <span>{data.problem.tl_ms}ms · {data.problem.ml_mb}MB</span>
                  <span>{data.stats?.accepted || 0}/{data.stats?.attempts || 0} accepted</span>
                  <span>{data.stats?.solvers || 0} solvers</span>
                  {data.attempts > 0 && <span>your runs: {data.attempts}</span>}
                </div>
              </div>

              <article className="prose">
                <Markdown text={data.problem.statement} />
                <SpecBlock title="Input" body={data.problem.input_format} />
                <SpecBlock title="Output" body={data.problem.output_format} />
                <SpecBlock title="Constraints" body={data.problem.constraints} mono />
                {data.problem.examples?.map((ex, i) => (
                  <div key={i} className="sample">
                    <div className="io">
                      <div><span className="lbl">Sample input {i + 1}</span><pre>{ex.input}</pre></div>
                      <div><span className="lbl">Sample output</span><pre>{ex.output}</pre></div>
                    </div>
                    {ex.explanation && <div className="exp"><span className="lbl">Explanation</span><br />{ex.explanation}</div>}
                  </div>
                ))}
                {data.problem.notes && <SpecBlock title="Note" body={data.problem.notes} />}
              </article>

              {data.recent?.length > 0 && (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <CardHead title="Your recent runs" kicker="history" right={<Link className="btn btn-sm btn-ghost" to={`/u/${user?.handle}`}>profile →</Link>} />
                  <table className="tbl">
                    <tbody>
                      {data.recent.slice(0, 6).map((s) => (
                        <tr key={s.id}>
                          <td className="mono small">{s.lang}</td>
                          <td><Verdict status={s.status} /></td>
                          <td className="mono small dim">{s.passed}/{s.total}</td>
                          <td className="mono small dim">{s.time_ms}ms</td>
                          <td className="r small dim2" style={{ fontSize: 11.5 }}>{new Date(s.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ============ RIGHT: editor dock ============ */}
            <div className="stack" style={{ gap: 16, minWidth: 0 }}>
              <div className="editor-card sticky-top">
                <div className="editor-bar">
                  <span className="file mono">main.{extFor(lang)}</span>
                  <select className="input" style={{ width: 118, padding: '4px 26px 4px 10px', fontSize: 12.5 }} value={lang} onChange={(e) => changeLang(e.target.value)} aria-label="Language">
                    {langs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn btn-sm btn-ghost" title="Smaller font" onClick={() => setFontSize((f) => Math.max(11, f - 1))}>A−</button>
                    <button className="btn btn-sm btn-ghost" title="Larger font" onClick={() => setFontSize((f) => Math.min(20, f + 1))}>A+</button>
                    <button className="btn btn-sm btn-ghost" title="Reset to starter template" onClick={() => { setCode(DEFAULTS[lang] || ''); }}>reset</button>
                  </div>
                </div>
                <EditorMount monacoRef={monacoRef} editorRef={editorRef} value={code}
                  lang={lang} fontSize={fontSize}
                  onCode={(v) => { setCode(v); localStorage.setItem(`ca:code:${id}:${lang}`, v); }}
                  onSubmit={submit} onRun={run} />
                <div className="spread" style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', gap: 8 }}>
                  <div className="row dim2" style={{ gap: 6, fontSize: 11 }}>
                    <span className="kbd">⌃⏎</span> submit <span className="kbd" style={{ marginLeft: 6 }}>⌃⇧⏎</span> run
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={run} disabled={!!busy}>Run</button>
                    <button className="btn btn-primary" onClick={submit} disabled={!!busy}>
                      {busy === 'submit' ? 'Judging…' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>

              <ResultPanel panel={panel} tab={tab} setTab={setTab} onResubmit={submit} />
            </div>
          </div>
        </>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="skeleton" style={{ height: 44, width: 420 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Monaco mount ---------------- */
function EditorMount({ monacoRef, editorRef, value, lang, fontSize, onCode, onSubmit, onRun }) {
  const holder = useRef(null);
  const cb = useRef({ onCode, onSubmit, onRun });
  cb.current = { onCode, onSubmit, onRun };
  useEffect(() => {
    let disposed = false;
    (async () => {
      const M = await import('../monaco.js');
      if (disposed || !holder.current) return;
      monacoRef.current = M.monaco;
      const ed = M.monaco.editor.create(holder.current, {
        value, language: MONACO_LANG[lang], theme: M.ARENA_THEME,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize, lineHeight: 1.55,
        minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false,
        padding: { top: 14, bottom: 14 }, renderLineHighlight: 'all', smoothScrolling: true,
        fontLigatures: true, tabSize: 4, autoIndent: 'full', roundedSelection: false,
        scrollbar: { verticalScrollbarSize: 9, horizontalScrollbarSize: 9 },
        overviewRulerBorder: false, guides: { indentation: true },
      });
      editorRef.current = ed;
      ed.onDidChangeModelContent(() => cb.current.onCode(ed.getValue()));
      ed.addCommand(M.monaco.KeyMod.CtrlCmd | M.monaco.KeyCode.Enter, () => cb.current.onSubmit());
      ed.addCommand(M.monaco.KeyMod.CtrlCmd | M.monaco.KeyMod.Shift | M.monaco.KeyCode.Enter, () => cb.current.onRun());
    })();
    return () => { disposed = true; try { editorRef.current?.dispose(); } catch {} editorRef.current = null; };
  }, []); // eslint-disable-line
  useEffect(() => { try { editorRef.current?.updateOptions({ fontSize }); } catch {} }, [fontSize]);
  return <div ref={holder} className="editor-mount" role="textbox" aria-label="Code editor" />;
}

/* ---------------- result / judging panel ---------------- */
function ResultPanel({ panel, tab, setTab, onResubmit }) {
  const [openT, setOpenT] = useState(null);
  if (!panel) return (
    <div className="card pad" style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="mono small">⟨ /dev/stdout ⟩</div>
        <p className="small" style={{ marginTop: 8, maxWidth: 260 }}>Run against sample tests, or submit for a full verdict on hidden cases.</p>
      </div>
    </div>
  );

  const pending = ['queued', 'judging', 'running'].includes(panel.status);
  const cls = panel.status === 'accepted' ? 'vb-accepted' : pending ? 'vb-pending' : 'vb-bad';
  const label = pending ? (panel.kind === 'run' ? 'RUNNING ON SAMPLES…' : 'JUDGING — IN QUEUE') : verdictLabel(panel.status);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className={'verdict-banner ' + cls}>
        {label}
        {!pending && <span className="dim2 small" style={{ marginLeft: 'auto', fontWeight: 500 }}>
          {panel.time_ms}ms{panel.mem_kb ? ` · ${Math.round(panel.mem_kb / 1024)}MB` : ''} · {panel.passed}/{panel.total}
        </span>}
      </div>
      {!pending && (
        <>
          <div className="result-tabs">
            <button className={'result-tab' + (tab === 'result' ? ' on' : '')} onClick={() => setTab('result')}>Result</button>
            {panel.details?.length > 0 && <button className={'result-tab' + (tab === 'tests' ? ' on' : '')} onClick={() => setTab('tests')}>Tests ({panel.details.length})</button>}
            {panel.err && <button className={'result-tab' + (tab === 'err' ? ' on' : '')} onClick={() => setTab('err')}>stderr</button>}
            {panel.kind === 'submit' && <button className="result-tab" onClick={onResubmit} style={{ marginLeft: 'auto' }}>resubmit ↻</button>}
          </div>
          {tab === 'result' && (
            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              {panel.kind === 'run' ? (
                panel.details?.slice(0, 4).map((d, i) => (
                  <div key={i}>
                    <div className="small dim" style={{ marginBottom: 4 }}>Sample {i + 1} — <span className={d.verdict === 'ok' ? '' : 'mono'} style={{ color: d.verdict === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{d.verdict === 'ok' ? 'match' : 'mismatch'}</span></div>
                    {d.verdict !== 'ok' && (
                      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div className="mono-box" style={{ maxHeight: 140 }}><div className="tiny dim2" style={{ marginBottom: 4 }}>EXPECTED</div>{d.want}</div>
                        <div className="mono-box" style={{ maxHeight: 140 }}><div className="tiny dim2" style={{ marginBottom: 4 }}>YOUR OUTPUT</div>{d.got || '(empty)'}</div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="small dim" style={{ padding: 6 }}>
                  {panel.status === 'accepted'
                    ? `All ${panel.total} test cases passed in ${panel.time_ms} ms.`
                    : panel.status === 'ce' ? 'The compiler rejected your source — see the stderr tab.'
                    : `Failed on test #${(panel.details?.find((d) => d.verdict !== 'ok')?.n) ?? '?'} of ${panel.total}.`}
                </div>
              )}
            </div>
          )}
          {tab === 'tests' && (
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
              {panel.details?.map((d) => (
                <div key={d.n} className="testline" onClick={() => setOpenT(openT === d.n ? null : d.n)} style={{ cursor: 'pointer' }}>
                  <span style={{ color: d.verdict === 'ok' ? 'var(--ok)' : 'var(--bad)' }}>{d.verdict === 'ok' ? '✓' : '✗'}</span>
                  <span>test {d.n}{d.hidden ? ' · hidden' : ' · sample'}</span>
                  <span className="dim2">{d.verdict === 'ok' ? `${d.time_ms}ms` : d.verdict.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'err' && <div style={{ padding: 12 }}><pre className="mono-box" style={{ color: '#ffb3b3' }}>{panel.err || '(no output)'}</pre></div>}
        </>
      )}
      {pending && (
        <div style={{ padding: 16 }}>
          <div className="progress"><div style={{ width: panel.status === 'queued' ? '18%' : '62%', transition: 'width 1.5s ease' }} /></div>
          <p className="tiny dim2 mono" style={{ marginTop: 10 }}>
            {panel.status === 'queued' ? 'queued — waiting for a judge slot' : 'supervisor spawning sandbox · applying rlimits'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */
const verdictLabel = (s) => ({ accepted: 'ACCEPTED', wa: 'WRONG ANSWER', tle: 'TIME LIMIT EXCEEDED', mle: 'MEMORY LIMIT EXCEEDED', re: 'RUNTIME ERROR', ce: 'COMPILE ERROR', internal_error: 'JUDGE ERROR' }[s] || String(s).toUpperCase());
const extFor = (l) => ({ python: 'py', javascript: 'js', cpp: 'cpp', java: 'java' }[l] || l);
export const MONACO_LANG = { python: 'python', javascript: 'javascript', cpp: 'cpp', java: 'java' };
export const DEFAULTS = {
  python: `import sys

def main():
    data = sys.stdin.buffer.read().decode()
    # solve here
    print()

if __name__ == "__main__":
    main()
`,
  javascript: `const data = require('fs').readFileSync(0, 'utf8');
// solve here
console.log();
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
  java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

    }
}
`,
};
const DEFAULT_PY = DEFAULTS.python;

/* tiny markdown subset — statements are authored in it; output is escaped */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function Markdown({ text }) {
  const html = useMemo(() => {
    const lines = String(text || '').split('\n');
    let out = '', para = [], inCode = false, codeBuf = [];
    const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    const flush = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br/>') + '</p>'; para = []; } };
    for (const l of lines) {
      if (l.trim().startsWith('```')) { if (inCode) { out += '<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>'; codeBuf = []; inCode = false; } else { flush(); inCode = true; } continue; }
      if (inCode) { codeBuf.push(l); continue; }
      const h = l.match(/^(#{1,3})\s+(.*)/);
      if (h) { flush(); out += `<h3>${inline(h[2])}</h3>`; continue; }
      if (l.trim().startsWith('> ')) { flush(); out += `<blockquote>${inline(l.trim().slice(2))}</blockquote>`; continue; }
      if (!l.trim()) { flush(); continue; }
      para.push(l);
    }
    flush();
    return out;
  }, [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function SpecBlock({ title, body, mono }) {
  if (!body) return null;
  return (
    <div style={{ margin: '18px 0 12px' }}>
      <div className="tiny mono" style={{ color: 'var(--ink-2)', marginBottom: 6, fontWeight: 700 }}>{title.toUpperCase()}</div>
      {mono
        ? <pre className="mono-box" style={{ background: 'transparent' }}>{body}</pre>
        : <Markdown text={body} />}
    </div>
  );
}
