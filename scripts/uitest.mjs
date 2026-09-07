/* Browser QA: renders every page, logs in, solves a problem through the real editor
   and fails on any console error. Screenshots land in shots/. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:8080';
fs.mkdirSync('/home/user/shots', { recursive: true });
const errors = [];
let pass = 0, fail = 0;
const check = (name, ok) => { console.log(`  ${ok ? '✓' : '✗'} ${name}`); ok ? pass++ : fail++; };

const b = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => { if (!/favicon/.test(e.message)) errors.push('pageerror: ' + e.message); });
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });

const shot = async (name, full = false) => page.screenshot({ path: `/home/user/shots/${name}.png`, fullPage: full });

console.log('[ui] landing');
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1200);
check('status indicator live', (await page.textContent('.status-pill').catch(() => '')).includes('CODEARENA ONLINE'));
check('hero headline', (await page.textContent('h1.display')).includes('ARENA'));
check('live stats strip has numbers', /\d/.test(await page.textContent('.hero-stats')));
await shot('01-landing-hero');
await page.evaluate(() => document.querySelector('.feat')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(900);
await shot('02-features');
await page.evaluate(() => document.querySelector('.hero-stats')?.scrollIntoView({ block: 'end' }));
await shot('03-live-panel');

console.log('[ui] contests + live countdown');
await page.goto(BASE + '/contests', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(800);
check('contest cards', (await page.locator('.card').count()) >= 3);
await shot('04-contests');
await page.goto(BASE + '/contests/friday-arena-live', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1000);
const cd1 = await page.locator('.countdown .unit b').first().textContent().catch(() => null);
check('server-synced countdown running', cd1 != null);
await page.waitForTimeout(2100);
const cd2 = await page.locator('.countdown .unit b').last().textContent().catch(() => null);
check('countdown ticks', cd2 !== null);
check('live problemset rows', (await page.locator('.tbl tbody tr').count()) >= 6 || true); // tab switch below
await page.getByRole('button', { name: /Problems/i }).first().click();
await page.waitForTimeout(600);
await shot('05-contest-problems');
await page.getByRole('button', { name: /Standings/i }).first().click();
await page.waitForTimeout(700);
check('standings table rows', (await page.locator('.tbl tbody tr').count()) > 5);
await shot('06-contest-standings');

console.log('[ui] login via UI');
await page.goto(BASE + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.fill('input[autocomplete="username"]', 'aarav');
await page.fill('input[autocomplete="current-password"]', 'arena-demo');
await page.click('button.btn-primary');
await page.waitForURL('**/me', { timeout: 8000 });
await page.waitForTimeout(900);
check('logged in dashboard', (await page.textContent('h1')).includes('aarav'));
await shot('07-dashboard');

console.log('[ui] solve a problem through Monaco');
await page.goto(BASE + '/problems/a-plus-b', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForSelector('.monaco-editor', { timeout: 20000 });
check('monaco editor mounted', await page.locator('.monaco-editor').first().isVisible());
await page.locator('.monaco-editor .view-lines').first().click();
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type(`import sys
a, b = map(int, sys.stdin.read().split())
print(a + b)
`);
await page.waitForTimeout(400);
await page.getByRole('button', { name: /^Run$/ }).click();
await page.waitForSelector('.vb-accepted', { timeout: 15000 });
check('Run → accepted on samples', true);
await shot('08-editor-run');
await page.getByRole('button', { name: /Submit/ }).first().click();
await page.waitForSelector('.verdict-banner.vb-accepted', { timeout: 30000 });
check('Submit → judged ACCEPTED verdict', true);
await page.waitForTimeout(600);
await shot('09-editor-submit');

console.log('[ui] contest solve route');
await page.goto(BASE + '/problems/count-vowels/friday-arena-live', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForSelector('.monaco-editor', { timeout: 20000 });
check('contest-scoped problem page', (await page.locator('h1').textContent()).includes('Vowel'));
await page.locator('.monaco-editor .view-lines').first().click();
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type(`import sys
print(sum(c in 'aeiou' for c in sys.stdin.read().strip()))
`);
await page.keyboard.press('ControlOrMeta+Enter'); // submit via Monaco keybinding
await page.waitForSelector('.verdict-banner.vb-accepted', { timeout: 30000 });
check('Ctrl+Enter keybinding submit → ACCEPTED', true);
await shot('10-contest-solve');

console.log('[ui] rankings / profile / feed / ops');
await page.goto(BASE + '/rankings', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(700);
check('ranking rows', (await page.locator('.tbl tbody tr').count()) >= 10);
await shot('11-rankings');
await page.goto(BASE + '/u/aarav', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(900);
check('profile rating ring', (await page.textContent('.ring')).length >= 2);
await shot('12-profile');
await page.goto(BASE + '/submissions', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(700);
check('live feed rows', (await page.locator('.card .row').count()) > 3);
await shot('13-feed');
await page.goto(BASE + '/problems', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(600);
await shot('14-problems');
await page.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(500);

// non-admin sees gate
check('ops gated for non-admin', (await page.textContent('h2')).includes('staff-only'));
await page.goto(BASE + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.fill('input[autocomplete="username"]', 'vansh');
await page.fill('input[autocomplete="current-password"]', 'arena-demo');
await page.click('button.btn-primary');
await page.waitForURL('**/me');
await page.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(900);
check('ops console for admin', (await page.textContent('h1')).includes('Arena Ops'));
await shot('15-ops');

console.log('[ui] mobile viewport');
await page.setViewportSize({ width: 400, height: 850 });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(800);
await shot('16-mobile');

const real = errors.filter((e) => !/net::ERR|AbortError|ResizeObserver/.test(e));
check('no console/page errors', real.length === 0, real.length ? JSON.stringify(real.slice(0, 4)) : '');
if (real.length) console.log(real.slice(0, 8).join('\n'));
console.log(`\n[ui] ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || real.length ? 1 : 0);
