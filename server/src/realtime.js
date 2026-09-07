/**
 * Realtime hub (Server-Sent Events). One long-lived stream per client.
 * Pushes: presence ticks (server-clock sync), submission verdicts,
 * contest transitions, leaderboard invalidations. No secrets on the wire —
 * only public metadata (ids, verdicts, counts).
 */
const clients = new Map(); // id -> { res, user, since }

export function addClient(res, user) {
  const id = Math.random().toString(36).slice(2);
  clients.set(id, { res, user: user?.id || null, handle: user?.handle || null, since: Date.now() });
  res.on('close', () => clients.delete(id));
  return () => clients.delete(id);
}

export function send(id, type, data) {
  const c = clients.get(id);
  if (!c) return;
  try { c.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}

export function broadcast(type, data) {
  for (const [, c] of clients) {
    try { c.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  }
}

export function toUser(userId, type, data) {
  for (const [, c] of clients) if (c.user === userId) {
    try { c.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  }
}

export function presence() {
  const t = Date.now();
  const users = new Set();
  let anonymous = 0;
  for (const [, c] of clients) {
    if (c.user) users.add(c.user); else anonymous++;
  }
  return { online_users: users.size, connections: clients.size, window_ms: t };
}

// heartbeat doubles as server-clock tick (clients re-sync countdowns on this)
setInterval(() => {
  broadcast('tick', { server_time: Date.now(), online: presence().online_users });
}, 25000);
