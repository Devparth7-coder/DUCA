import { useEffect, useRef, useState } from 'react';
import { serverNow, fmt } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { ratingTier } from './Nav.jsx';

/* ---- reveal-on-scroll ---- */
export function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => el.classList.add('in'), delay); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className={'reveal ' + className}>{children}</div>;
}

/* ---- server-synced countdown ---- */
export function Countdown({ target, onDone, prefix, size = 'md' }) {
  const [left, setLeft] = useState(() => target - serverNow());
  useEffect(() => {
    let raf;
    const tick = () => {
      const d = target - serverNow();
      setLeft(d);
      if (d <= 0) { onDone?.(); return; }
      raf = setTimeout(tick, 250);
    };
    tick();
    return () => clearTimeout(raf);
  }, [target]); // eslint-disable-line
  const s = Math.max(0, Math.floor(left / 1000));
  const units = [
    [Math.floor(s / 86400), 'days'], [Math.floor((s % 86400) / 3600), 'hrs'],
    [Math.floor((s % 3600) / 60), 'min'], [s % 60, 'sec'],
  ];
  if (left <= 0) return <span className="mono dim">{prefix || 'Started'} — 00:00</span>;
  if (size === 'sm') return <span className="mono" style={{ fontWeight: 700 }}>{fmt.clock(left)}</span>;
  return (
    <div className="countdown" role="timer" aria-label={`${prefix || ''} remaining`}>
      {units.map(([v, l]) => <span className="unit" key={l}><b>{String(v).padStart(2, '0')}</b><i>{l}</i></span>)}
    </div>
  );
}

/* ---- verdict ---- */
export const VERDICT = {
  accepted: ['Accepted', 'ac'], wrong_answer: ['Wrong Answer', 'wa'], wa: ['Wrong Answer', 'wa'],
  time_limit_exceeded: ['Time Limit', 'tle'], tle: ['Time Limit', 'tle'],
  memory_limit_exceeded: ['Memory Limit', 'mle'], mle: ['Memory Limit', 'mle'],
  runtime_error: ['Runtime Error', 're'], re: ['Runtime Error', 're'],
  compilation_error: ['Compile Error', 'ce'], ce: ['Compile Error', 'ce'],
  internal_error: ['Judge Error', 'ie'], queued: ['Queued', 'q'], judging: ['Judging…', 'q'],
};
export function Verdict({ status, big = false }) {
  const [label] = VERDICT[status] || [status, 'q'];
  return <span className={'v v-' + status} style={big ? { fontSize: 13, padding: '4px 12px' } : undefined}>{label}</span>;
}

/* ---- rating ---- */
export function Rating({ value, delta, showPeak }) {
  if (value == null) return <span className="dim">unrated</span>;
  const tier = ratingTier(value);
  return (
    <span className="mono" style={{ fontWeight: 700, color: `var(--rt-${tier})`, colorScheme: 'dark' }}>
      <span style={{ color: `var(--${tier === 'new' ? 'ink-3' : tier === 'pupil' ? 'ok' : tier === 'specialist' ? 'accent-2' : tier === 'expert' ? '#c084fc' : tier === 'cm' ? 'var(--warn)' : 'var(--bad)'})` }}>{value}</span>
      {delta != null && <small style={{ marginLeft: 6, color: delta >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{delta >= 0 ? '+' : ''}{delta}</small>}
      {showPeak && <small className="dim2" style={{ marginLeft: 8, fontWeight: 500 }}>peak {showPeak}</small>}
    </span>
  );
}

/* ---- sparkline for ratings history ---- */
export function Spark({ points, width = 260, height = 64 }) {
  if (!points?.length) return <div className="dim small" style={{ padding: '18px 0' }}>No rated contests yet — your line starts at your first submission.</div>;
  const vals = points.map((p) => p.rating);
  const min = Math.min(...vals, 1500) - 40, max = Math.max(...vals, 1550) + 40;
  const xs = (i) => 6 + (i * (width - 12)) / Math.max(1, points.length - 1);
  const ys = (v) => height - 6 - ((v - min) * (height - 12)) / (max - min);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.rating).toFixed(1)}`).join(' ');
  const area = `${d} L${xs(points.length - 1)},${height - 4} L${xs(0)},${height - 4} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c8cff" stopOpacity=".35" /><stop offset="1" stopColor="#7c8cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={d} fill="none" stroke="#8b9bff" strokeWidth="1.6" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.rating)} r="2.6" fill={p.delta >= 0 ? '#3ddc97' : '#ff6b6b'} />)}
    </svg>
  );
}

/* ---- submission heatmap ---- */
export function Heat({ activity }) {
  const byDay = new Map((activity || []).map((a) => [a.day, a.c]));
  const today = Math.floor(serverNow() / 86400000);
  const start = today - 7 * 25;
  const cells = [];
  const max = Math.max(4, ...(activity || []).map((a) => a.c));
  for (let d = start; d <= today; d++) {
    const c = byDay.get(d) || 0;
    const lvl = c === 0 ? 0 : c >= max * 0.7 ? 4 : c >= max * 0.45 ? 3 : c >= max * 0.2 ? 2 : 1;
    cells.push(<i key={d} className={lvl ? 'l' + lvl : ''} title={`${new Date(d * 86400000).toDateString()} — ${c} submissions`} />);
  }
  // pad leading week
  const pad = 7 - (start % 7 || 7);
  return <div className="heat">{Array.from({ length: pad % 7 }).map((_, i) => <i key={'p' + i} />)}{cells}</div>;
}

/* ---- contest status pill ---- */
export function ContestStatus({ status }) {
  const map = { live: ['LIVE', 'c-live'], upcoming: ['UPCOMING', 'c-upcoming'], finished: ['COMPLETED', 'c-finished'] };
  const [label, cls] = map[status] || [status, ''];
  return (
    <span className={`tag-status ${cls}`} style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
      {status === 'live' && <span className="livedot" />}{label}
    </span>
  );
}

export function DiffTag({ d, link }) {
  return <span className={'diff diff-' + d}>{d.toUpperCase()}</span>;
}

export function ProblemLink({ id, children, contest }) {
  return <Link to={'/problems/' + id + (contest ? '/' + contest : '')}>{children ?? id}</Link>;
}

/* ---- generic data table card header ---- */
export function CardHead({ title, right, kicker }) {
  return (
    <div className="spread" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
      <div>
        {kicker && <div className="tiny dim2" style={{ marginBottom: 2 }}>{kicker}</div>}
        <h3 style={{ fontSize: 15.5 }}>{title}</h3>
      </div>
      {right}
    </div>
  );
}
