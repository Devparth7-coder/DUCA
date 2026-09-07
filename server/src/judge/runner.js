import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { jparse, now } from '../util.js';
import { LANGS } from './languages.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SUP = path.join(HERE, 'sup.py');

const sandboxEnv = (wd) => ({
  PATH: '/usr/local/bin:/usr/bin:/bin',
  HOME: wd, TMPDIR: wd, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
  PYTHONDONTWRITEBYTECODE: '1', PYTHONHASHSEED: '0',
  JAVA_TOOL_OPTIONS: '-XX:ErrorFile=/dev/stderr',
});

const SANDBOX_OK = { python: 'python3', cpp: 'g++', java: 'javac', javascript: 'node' };

export async function probeCapabilities() {
  const caps = { supervisor: 'python3', languages: {}, limits: { concurrency: config.judge.concurrency } };
  const VERSION_FLAGS = { python: '--version', cpp: '--version', java: '-version', javascript: '-v' };
  for (const [k, bin] of Object.entries(SANDBOX_OK)) {
    caps.languages[k] = await new Promise((res) => {
      const c = spawn(bin, [VERSION_FLAGS[k] || '--version'], { env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8' } });
      let out = '';
      c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
      c.on('error', () => res({ ok: false }));
      c.on('close', (code) => res(code === 0 ? { ok: true, version: out.split('\n')[0].trim().slice(0, 80) } : { ok: false }));
      setTimeout(() => { try { c.kill('SIGKILL'); } catch {} }, 4000);
    });
  }
  return caps;
}

export function makeWorkdir(tag) {
  const wd = path.join(os.tmpdir(), `ca-${tag}-${crypto.randomBytes(5).toString('hex')}`);
  fs.mkdirSync(wd, { recursive: true });
  return wd;
}

export function cleanupWorkdirs(maxAgeMs = 3600000) {
  try {
    const t = now();
    for (const f of fs.readdirSync(os.tmpdir())) {
      if (!f.startsWith('ca-')) continue;
      const p = path.join(os.tmpdir(), f);
      try { const st = fs.statSync(p); if (t - st.mtimeMs > maxAgeMs) fs.rmSync(p, { recursive: true, force: true }); } catch {}
    }
  } catch {}
}

const execFile2 = (cmd, args, opts) =>
  new Promise((resolve) => {
    const c = spawn(cmd, args, opts);
    let out = '', err = '';
    c.stdout?.on('data', (d) => { if (out.length < 40000) out += d; });
    c.stderr?.on('data', (d) => { if (err.length < 40000) err += d; });
    c.on('error', (e) => resolve({ code: -1, out, err: String(e) }));
    c.on('close', (code) => resolve({ code, out, err }));
  });

export function normalizeOutput(s) {
  return String(s).replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n+$/g, '');
}

/**
 * Judge one submission. Returns { status, passed, total, time_ms, mem_kb, err, details }.
 * Never touches the request path's env beyond scrubbed sandboxEnv.
 */
export async function judgeRun({ langKey, code, tests, tlMs, mlMb, samplesOnly = false }) {
  const lang = LANGS[langKey];
  if (!lang) return { status: 'internal_error', err: 'unknown language', details: [] };
  if (Buffer.byteLength(code) > config.judge.maxCodeBytes)
    return { status: 'internal_error', err: 'source exceeds size limit', details: [] };

  const wd = makeWorkdir('judge');
  const tl = Math.min(10000, Math.max(250, tlMs || 2000));
  const ml = Math.min(1024, Math.max(32, mlMb || 256));
  try {
    fs.writeFileSync(path.join(wd, lang.file), code, 'utf8');

    if (lang.compile) {
      const cmd = lang.compile(ml);
      const c = await execFile2(cmd[0], cmd.slice(1), { cwd: wd, env: sandboxEnv(wd), timeout: config.judge.compileMs, killSignal: 'SIGKILL' });
      if (c.code !== 0) {
        return {
          status: 'ce', passed: 0, total: tests.length, time_ms: 0, mem_kb: 0,
          err: (c.err || c.out || 'compilation failed').split('\n').slice(0, 24).join('\n'),
          details: [],
        };
      }
    }

    const active = samplesOnly ? tests.filter((t) => !t.hidden) : tests;
    const details = [];
    let passed = 0, maxTime = 0, maxMem = 0, failure = null;

    for (let i = 0; i < active.length; i++) {
      const t = active[i];
      const r = await runOne(wd, lang, t, i, tl, ml);
      const ok = r.verdict === 'ok';
      if (ok) passed++;
      maxTime = Math.max(maxTime, r.time_ms);
      maxMem = Math.max(maxMem, r.mem_kb);
      details.push({
        n: i + 1, hidden: !!t.hidden, verdict: ok ? 'ok' : r.verdict,
        time_ms: r.time_ms, mem_kb: r.mem_kb, error: r.err || '',
        got: ok || samplesOnly ? String(r.stdout || '').slice(0, 4000) : '',
        want: samplesOnly ? String(t.output).slice(0, 4000) : '',
      });
      if (!ok && !failure) failure = r;
      if (!samplesOnly && failure) break; // stop on first failure for full runs
    }

    if (failure) {
      return {
        status: failure.verdict, passed, total: active.length, time_ms: maxTime, mem_kb: maxMem,
        err: failure.err || '', details,
      };
    }
    return { status: 'accepted', passed, total: active.length, time_ms: maxTime, mem_kb: maxMem, err: '', details };
  } finally {
    fs.rmSync(wd, { recursive: true, force: true });
  }
}

function runOne(wd, lang, test, idx, tl, ml) {
  return new Promise(async (resolve) => {
    const inf = path.join(wd, `in${idx}`), resf = path.join(wd, `r${idx}.json`);
    fs.writeFileSync(inf, String(test.input ?? ''));
    const cmd = typeof lang.run === 'function' ? lang.run(ml) : lang.run;
    const cfg = JSON.stringify({
      mem_mb: ml + (lang.pad || 0), as: lang.as ? 1 : 0,
      cpu_s: Math.max(1, Math.ceil((tl * 1.25 + 1000) / 1000)),
      wall_ms: Math.ceil(tl * 1.25) + 900, out: resf,
    });
    const fin = fs.openSync(inf, 'r');
    const t0 = now();
    const child = spawn('python3', [SUP, cfg, '--', ...cmd], {
      cwd: wd, env: sandboxEnv(wd), stdio: [fin, 'pipe', 'pipe'], detached: true,
    });
    let stdout = '', stderr = '', truncated = false;
    const cap = (bufName, d) => {
      if (stdout.length + stderr.length > config.judge.maxOutputBytes) { truncated = true; return; }
      if (bufName === 'o') stdout += d; else stderr += d;
    };
    child.stdout.on('data', (d) => cap('o', d.toString('utf8')));
    child.stderr.on('data', (d) => cap('e', d.toString('utf8')));
    const watchdog = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} try { child.kill('SIGKILL'); } catch {} }, tl + 4500);

    const done = () => {
      clearTimeout(watchdog);
      try { fs.closeSync(fin); } catch {}
      const res = jparse(safeRead(resf), null);
      let verdict = 'ok';
      if (!res) verdict = 'tle'; // supervisor was killed — treat as runaway
      else if (res.tle || res.signal === 9 || res.signal === 24 || res.signal === 25) verdict = 'tle';
      else if (res.mem_kb > ml * 1024 || /MemoryError|OutOfMemoryError|heap out of memory|std::bad_alloc/i.test(stderr)) verdict = 'mle';
      else if (res.exit !== 0) verdict = 're';
      else if (truncated || normalizeOutput(stdout) !== normalizeOutput(test.output)) verdict = 'wa';
      resolve({
        verdict, time_ms: res?.time_ms ?? (now() - t0), mem_kb: res?.mem_kb ?? 0,
        stdout: stdout.slice(0, config.judge.maxOutputBytes),
        err: verdict === 're' ? stderr.split('\n').filter(Boolean).slice(0, 6).join('\n').slice(0, 900) : '',
      });
    };
    child.on('close', done);
    child.on('error', () => { try { fs.closeSync(fin); } catch {}; resolve({ verdict: 're', time_ms: 0, mem_kb: 0, stdout: '', err: 'failed to launch sandbox' }); });
  });
}

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
