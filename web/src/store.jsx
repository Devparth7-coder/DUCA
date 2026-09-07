import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api, openStream, syncClock, serverNow } from './lib/api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=anon
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState({}); // last payload per SSE event type
  const [toasts, setToasts] = useState([]);
  const subs = useRef(new Map()); // event -> Set<handler>
  const [colleges, setColleges] = useState([]);

  const toast = useCallback((msg, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const on = useCallback((name, fn) => {
    if (!subs.current.has(name)) subs.current.set(name, new Set());
    subs.current.get(name).add(fn);
    return () => subs.current.get(name).delete(fn);
  }, []);

  useEffect(() => {
    syncClock();
    const iv = setInterval(syncClock, 5 * 60000);
    api.get('/api/auth/me').then((r) => setUser(r.user || null)).catch(() => setUser(null));
    api.get('/api/system/status').then(setStatus).catch(() => {});
    const sv = setInterval(() => api.get('/api/system/status').then(setStatus).catch(() => {}), 30000);
    api.get('/api/colleges').then((r) => setColleges(r)).catch(() => {});
    const off = openStream({
      hello: (d) => { if (d.server_time) api.get('/api/system/status').then(setStatus).catch(() => {}); },
      tick: () => api.get('/api/system/status').then(setStatus).catch(() => {}),
      submission: (d) => { setEvents((e) => ({ ...e, submission: d })); },
      submission_status: (d) => setEvents((e) => ({ ...e, submission_status: d })),
      contest_status: (d) => { setEvents((e) => ({ ...e, contest_status: d })); api.get('/api/system/status').then(setStatus).catch(() => {}); },
      standings_changed: (d) => setEvents((e) => ({ ...e, standings_changed: d })),
      ratings_published: (d) => setEvents((e) => ({ ...e, ratings_published: d })),
      personal: (d) => {
        setEvents((e) => ({ ...e, personal: d }));
        if (d?.achievements?.length) toast(`Achievement unlocked — ${d.achievements.length} new`, 'gold');
      },
    });
    return () => { off(); clearInterval(iv); clearInterval(sv); };
  }, [toast]);

  // refresh user after auth mutations
  const refreshUser = useCallback(async () => {
    const r = await api.get('/api/auth/me');
    setUser(r.user || null);
    return r.user;
  }, []);

  const fire = useCallback((name, data) => {
    subs.current.get(name)?.forEach((fn) => { try { fn(data); } catch {} });
  }, []);
  useEffect(() => { for (const [k, v] of Object.entries(events)) if (v) fire(k, v); }, [events, fire]);

  const value = useMemo(() => ({
    user, setUser, refreshUser, status, colleges, toast, on, serverNow,
    events,
  }), [user, refreshUser, status, colleges, toast, on, events]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}
