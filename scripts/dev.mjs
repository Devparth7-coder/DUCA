#!/usr/bin/env node
/* Dev runner: API server (:8080) + Vite dev server (:5173, proxied to API). */
import { spawn } from 'node:child_process';

const kids = [];
function run(name, cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, stdio: 'inherit', shell: false, env: process.env });
  kids.push(p);
  p.on('exit', (c) => { console.log(`[${name}] exited ${c}`); shutdown(); });
}
function shutdown() { for (const k of kids) { try { k.kill('SIGTERM'); } catch {} } process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

run('api', 'node', ['--watch', 'server/src/index.js'], new URL('..', import.meta.url).pathname);
run('web', 'npm', ['run', 'dev'], new URL('../web', import.meta.url).pathname);
console.log('[dev] api http://localhost:8080 · web http://localhost:5173');
