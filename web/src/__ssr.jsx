/* SSR render smoke: mounts the full App (all shared providers + router shell)
   and renders each route once, catching render-phase crashes without a browser. */
import { renderToString } from 'react-dom/server';

globalThis.location = globalThis.location || { pathname: '/', search: '', href: 'http://x/' };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.EventSource = class { close() {} addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
globalThis.devicePixelRatio = 1;

const routes = ['/', '/contests', '/contests/friday-arena-live', '/problems', '/problems/a-plus-b',
  '/rankings', '/u/aarav', '/me', '/submissions', '/auth/login', '/auth/register', '/ops', '/nope'];

async function main() {
  const { App } = await import('./App.jsx');
  let bad = 0;
  for (const r of routes) {
    globalThis.location = { ...globalThis.location, pathname: r };
    try {
      const html = renderToString(<App />);
      const len = html.length;
      console.log(`  ✓ ${r.padEnd(34)} rendered ${len} chars`);
      if (len < 500) { console.log(`    ! suspiciously empty`); bad++; }
    } catch (e) {
      console.log(`  ✗ ${r} — ${e.message}`);
      bad++;
    }
  }
  console.log(bad ? `[ssr] FAILED (${bad})` : '[ssr] all routes render clean');
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
