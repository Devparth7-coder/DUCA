# DEVUNITY CODEARENA

> **Compete. Build. Improve. Belong.**

A competitive-programming and developer-community platform for student developers: rated contests, a
sandboxed multi-language judge, real leaderboards, college rankings, achievements and analytics.
Built to feel like developer infrastructure — not a template.

**Live status indicator, ratings, standings, acceptance rates and timings on this platform are computed
from the database at request time. Nothing is fabricated — if the judge hasn't measured it, the UI shows `—`.**

---

## 1. What's in the box

| Surface | Notes |
|---|---|
| **Landing** | Cinematic hero (animated grid, floating code fragments, particle constellation, cursor parallax), server-backed live stats strip, feature rail (COMPETE / SOLVE / RISE / BELONG), live contest rail, judge architecture section |
| **Contests** | Upcoming / Live / Completed computed from server clock; registration; ICPC-style live standings (solves → penalty → earliest AC); countdown + progress synced to **server time** (client offset measured via `/api/time` and refined by SSE ticks); rating deltas published when a rated round ends |
| **Problems** | Statement (safe markdown subset), input/output/constraints/examples, tags, acceptance stats, personal run history; difficulty + tag filters |
| **Editor** | Monaco (VS Code's engine) — syntax highlighting, line numbers, auto-indent, `Ctrl+Enter` submit, `Ctrl+Shift+Enter` run, font controls, per-language starter templates, per-problem/per-language autosave |
| **Judge** | Queue → worker → sandboxed supervisor (`rlimits`) → per-test verdicts with real measured time + peak RSS; verdicts: `accepted, wa, tle, mle, re, ce, internal_error` |
| **Rankings** | Global Elo board, college board (transparent formula: Σ max(0, rating−1400) over top-5 members + 25×accepted), search, your-rank pill |
| **Profiles** | Rating history sparkline + per-contest table, solved grid, submission heatmap (25 weeks), per-difficulty accuracy, topic stats, achievements earned from records |
| **Live feed** | Every judged submission streams over SSE to all clients |
| **Ops console** (staff) | Queue telemetry, probed judge capabilities, JSON authoring for contests & problems, on-demand re-rating |
| **Auth** | Registration, scrypt-hashed passwords, HttpOnly session cookies, CSRF-guarded mutations, rate limiting |

14 problems (Easy→Hard) ship with generated hidden tests, 4 colleges × 12 seeded members, 3 contests
(two completed with published ratings, one **live**, one upcoming) and ~136 seeded submissions — **all
executed through the real sandboxed judge** during seeding, so demo verdicts/timings are genuine measurements.

Demo logins (after seed): `aarav / arena-demo` (member) · `vansh / arena-demo` (staff/Ops).

---

## 2. Architecture

```
Browser (React 18 + Monaco, Vite build, no CSS framework)
   │  JSON /api          SSE /api/stream
   ▼
Node HTTP server (zero-framework, stdlib only)
   ├─ auth (scrypt + DB sessions, HttpOnly cookies)
   ├─ REST API (portable SQL; SQLite or Postgres)
   ├─ SSE hub: presence, verdicts, contest transitions, clock ticks
   ├─ judge queue (bounded worker slots)
   │     └─ supervisor: python3 rlimit wrapper
   │           ├─ RLIMIT_CPU / RLIMIT_AS / RLIMIT_FSIZE=0 / RLIMIT_CORE=0 / RLIMIT_NOFILE
   │           ├─ per-test wall-clock watchdog (kills the process group)
   │           └─ measures wall time + peak RSS per test (getrusage)
   └─ static: serves web/dist with immutable asset caching + CSP
```

Languages: **Python 3, Node.js, C++17 (g++), Java (javac/java)** — each toolchain is probed at boot and
the results are shown live in the UI and `/api/system/status`.

### Why verdicts are trustworthy

- User code never executes in the request path or with the API's environment (scrubbed `PATH`-only env).
- Every test run gets fresh rlimits through the supervisor: CPU time, address space, **zero file-size**
  (file-write exploits die), no core dumps, capped FDs, plus a parent-side watchdog kill.
- The judge compares normalized stdout; time/memory in the UI are what the sandbox measured.
- The demo dataset itself is produced by submitting reference solutions through this pipeline —
  the seeder aborts if any verdict disagrees with its test data.

### Honest limitations (first release)

- Isolation is rlimit + env-scrubbing based. For hostile multi-tenant traffic, run the judge in a
  container per execution (see `Dockerfile` + `JUDGE_*` notes) or add `unshare -rn` / gVisor — the
  queue worker boundary is already in place for that swap.
- Network egress from the sandbox is not blocked in-process (needs netns/seccomp at the container layer).
- Rating engine is simplified Elo (K=32, placement-derived score) — transparent and fair, not Codeforces MMR.

---

## 3. Run locally

```bash
node -v            # >= 20
npm run install:all
npm run build      # web → web/dist
npm run seed       # optional — first `npm start` auto-seeds an empty DB (runs the judge for real)
npm start          # http://localhost:8080
```

Dev mode (hot reload): `npm run dev` → API :8080 + Vite :5173 (proxied).

Tests:

```bash
npm run smoke   # 25 API/judge/auth/SSE checks against a running server
npm run uitest  # Playwright browser QA incl. a real Monaco submit → ACCEPTED flow
```

## 4. Database

`server/src/db` speaks one SQL dialect over two drivers:

- **no `DATABASE_URL`** → SQLite (`better-sqlite3`) at `data/codearena.db` — zero setup.
- **`DATABASE_URL` set** → Postgres (`pg`) — the Render path, no code change.

Schema is applied idempotently at boot (`server/src/db/schema.sql`).

## 5. Deploy to Render

### Option A — Blueprint (free web + free Postgres, fastest)

1. Push this repo to GitHub → Render → **New → Blueprint** → pick the repo.
2. `render.yaml` provisions: `codearena` (Node 20, free plan) + `codearena-db` (free Postgres).
   Build command installs both workspaces, builds `web/`, boots `server/src/index.js`.
3. Env is wired automatically (`PORT`, `NODE_ENV=production`, `DATABASE_URL`, `AUTOSEED=1`).
4. First boot seeds the arena (a few real judged runs — ~30 s). Done.

> On Render's Ubuntu image, **Python and C++ toolchains are present** (the judge works out of the box);
> install `default-jdk-headless` via the Docker path below if you need Java in production too.

### Option B — Docker (all four languages, persistent volume)

Render → New Web Service → **Docker**. The `Dockerfile` bundles `python3`, `g++`, `default-jdk-headless`
and Node 20, builds the SPA and serves API + static from one process; mount `/var/lib/codearena` for
SQLite persistence. Set `DATABASE_URL` to Render Postgres instead of a volume if you prefer.

### Post-deploy checklist

- [ ] `GET /api/system/status` returns `judge.languages.*.ok` — that's the live judge.
- [ ] Create your admin account → Ops page → schedule a real contest (start/end epoch ms).
- [ ] Set a real domain, keep HTTPS (cookies become `Secure` automatically in production).

## 6. Repo map

```
server/src
  index.js        boot, static, SSE, contest ticker, queue wiring
  api.js          all REST endpoints (auth, problems, contests, judging, rankings, admin)
  auth.js         scrypt passwords, DB sessions, HttpOnly cookies, presence
  stats.js        standings, rating engine, achievements, system status, college board
  realtime.js     SSE hub + broadcast + clock ticks
  config.js       env loader (no dotenv dependency)
  db/             driver(s), schema, seed (real judged submissions)
  judge/          languages, queue, rlimit supervisor (sup.py), runner
web/src
  theme.css       the whole design system (dark-first, hairlines, mono data)
  App.jsx, store.jsx, lib/{api,router}.js
  components/     Nav (status pill), Countdown (server-synced), Verdict, Spark, Heat…
  pages/          Home, Contests, ContestDetail, Problems, ProblemDetail (Monaco),
                  Leaderboard, Profile, Dashboard, Submissions, Auth, Ops
scripts/          smoke.mjs (API E2E), uitest.mjs (Playwright), dev.mjs
render.yaml       Blueprint: web service + free Postgres
Dockerfile        full-judge production image (4 languages)
```

## 7. Design language

Deep near-black (`#06070a`) surfaces, 1px hairline borders, one restrained violet→mint accent used for
CTAs and the brand mark, JetBrains Mono for anything technical, Inter for everything else, soft glow only
where state deserves it (live, accepted, rank). No stock imagery: the identity system is the geometric
"D" mark (logo = favicon = profile tiles), generated identicon avatars, and inline SVG data-viz.

---

© DevUnity Tech Club — built as if it were going to production. It behaves like it did.
