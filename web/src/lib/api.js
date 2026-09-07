/* API client + server-clock sync.
   Every countdown/progress bar in the app resolves "now" through serverNow(),
   never the raw client clock. */

let offset = 0; // serverNow - clientNow
export const serverNow = () => Date.now() + offset;

async function call(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-requested-with': 'codearena', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `request failed (${res.status})`), { status: res.status });
  return data;
}

export const api = {
  get: (p) => call(p),
  post: (p, body) => call(p, { method: 'POST', body }),
};

export async function syncClock() {
  try {
    const t0 = Date.now();
    const r = await call('/api/time');
    const t1 = Date.now();
    const rtt = t1 - t0;
    offset = r.server_time - (t1 - rtt / 2);
  } catch { /* offline — keep last offset */ }
  return offset;
}

/* SSE stream with reconnect + clock re-sync on every tick */
export function openStream(handlers) {
  let es = null, closed = false, retry = 1000;
  const names = ['hello', 'tick', 'submission', 'submission_queued', 'submission_status', 'contest_status', 'standings_changed', 'ratings_published', 'personal'];
  const connect = () => {
    if (closed) return;
    es = new EventSource('/api/stream');
    es.onopen = () => { retry = 1000; };
    for (const n of names) {
      es.addEventListener(n, (e) => {
        let data = {};
        try { data = JSON.parse(e.data); } catch {}
        if (n === 'hello' || n === 'tick') {
          if (data.server_time) offset = data.server_time - Date.now(); // no-RTT refinement; ticks are 1s-accurate enough
        }
        handlers[n]?.(data);
      });
    }
    es.onerror = () => {
      try { es.close(); } catch {}
      if (!closed) { setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); }
    };
  };
  connect();
  return () => { closed = true; try { es?.close(); } catch {} };
}

export const fmt = {
  dur(ms) {
    if (ms == null) return '—';
    ms = Math.max(0, ms);
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
    return `${s}s`;
  },
  clock(ms) {
    if (ms == null) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return [h, m, ss].map((x) => String(x).padStart(2, '0')).join(':');
  },
  date(ms) { return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); },
  day(ms) { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); },
  ago(ms) {
    const d = serverNow() - ms;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return `${Math.floor(d / 86400000)}d ago`;
  },
  num(v) { return v == null ? '—' : Number(v).toLocaleString(); },
  kb(v) { return !v ? '—' : v >= 1024 ? (v / 1024).toFixed(1) + ' MB' : v + ' KB'; },
};
