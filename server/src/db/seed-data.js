/**
 * Problem catalogue for the demo arena.
 * Each problem ships: statement, examples, a reference solution per language, and a
 * case generator + independent JS "setter solution" used to derive expected outputs.
 * Seeded submissions are executed through the real judge, so every verdict/time in
 * the demo dataset is genuine measurement.
 */

const rand = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const ri = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

export const PROBLEMS = [
  {
    id: 'a-plus-b', title: 'Arena Warmup — Sum of Two', difficulty: 'Easy', tags: ['implementation', 'math'],
    statement:
`You are standing at the gates of the arena, and every competitor must pass the same trial: read **two integers**, add them, and print the result.

Seems trivial — and it is. Use this one to verify that your toolchain, your I/O habits, and the judge are all in sync before you dive into the rated rounds.`,
    input_format: 'One line containing two integers a and b (-1e9 <= a, b <= 1e9).',
    output_format: 'A single integer: a + b.',
    constraints: '-10^9 <= a, b <= 10^9\n\nTime limit: 1.0 s',
    examples: [{ input: '3 4\n', output: '7\n', explanation: '3 + 4 = 7.' }, { input: '-1 1\n', output: '0\n', explanation: 'They cancel out.' }],
    tests: 8, seed: 11,
    gen: {
      make: (r) => { const a = ri(r, -1000000000, 1000000000), b = ri(r, -1000000000, 1000000000); return String(a) + ' ' + String(b) + '\n'; },
      solve: (inp) => { const [a, b] = inp.trim().split(/\s+/).map(BigInt); return (a + b).toString(); },
    },
    ref: {
      python: 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n',
      javascript: "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(BigInt);\nconsole.log((a + b).toString());\n",
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ long long a,b; if(cin>>a>>b) cout<<a+b<<"\\n"; return 0; }\n',
      java: 'import java.util.*; public class Main { public static void main(String[] a) { Scanner sc = new Scanner(System.in); System.out.println(sc.nextLong() + sc.nextLong()); } }\n',
    },
  },
  {
    id: 'count-vowels', title: 'Vowel Census', difficulty: 'Easy', tags: ['strings', 'implementation'],
    statement:
`The arena announcer only shouts **vowels**. Given a sentence made of lowercase words, count how many of its characters are vowels (a, e, i, o, u).

Spaces and consonants are ignored.`,
    input_format: 'One line: a string of lowercase letters and spaces (1 <= length <= 200).',
    output_format: 'A single integer — the number of vowels.',
    constraints: 'Only characters a-z and single spaces appear.\n\nTime limit: 1.0 s',
    examples: [{ input: 'devunity arena\n', output: '6\n', explanation: 'e, u, i, a, e, a gives 6.' }],
    tests: 7, seed: 22,
    gen: {
      make: (r) => { const n = ri(r, 2, 7); const w = () => { const len = ri(r, 1, 12); let s = ''; for (let i = 0; i < len; i++) s += LOWER[ri(r, 0, 25)]; return s; }; return Array.from({ length: n }, w).join(' ') + '\n'; },
      solve: (inp) => String([...inp.replace(/\n+$/, '')].filter((c) => 'aeiou'.includes(c)).length),
    },
    ref: {
      python: "import sys\ns = sys.stdin.read().rstrip('\\n')\nprint(sum(c in 'aeiou' for c in s))\n",
      javascript: "const s = require('fs').readFileSync(0, 'utf8').replace(/\\n+$/, '');\nconsole.log([...s].filter(c => 'aeiou'.includes(c)).length);\n",
    },
  },
  {
    id: 'balanced-brackets', title: 'Balanced Brackets', difficulty: 'Easy', tags: ['stack', 'strings'],
    statement:
`A sequence of brackets is **balanced** when every opening bracket closes in the correct order.

Given a string containing only parentheses, square and curly brackets, decide whether it is balanced. Classic. Essential. The stack is your friend.`,
    input_format: 'One line containing a string of 1 to 100 bracket characters from ()[]{}.',
    output_format: 'Print YES if balanced, NO otherwise.',
    constraints: 'The string contains only ()[]{} characters.\n\nTime limit: 1.0 s',
    examples: [{ input: '{[()]}\n', output: 'YES\n' }, { input: '([)]\n', output: 'NO\n', explanation: 'Crossed brackets never close cleanly.' }],
    tests: 8, seed: 33,
    gen: {
      make: (r) => { const n = ri(r, 1, 24); let s = ''; for (let i = 0; i < n; i++) s += '()[]{}'[ri(r, 0, 5)]; return s + '\n'; },
      solve: (inp) => {
        const st = []; const pair = { ')': '(', ']': '[', '}': '{' };
        for (const c of inp.trim()) { if ('([{'.includes(c)) st.push(c); else if (st.pop() !== pair[c]) return 'NO'; }
        return st.length ? 'NO' : 'YES';
      },
    },
    ref: {
      python: "import sys\ns = sys.stdin.read().strip()\nst = []\npair = {')': '(', ']': '[', '}': '{'}\nok = 1\nfor c in s:\n    if c in '([{':\n        st.append(c)\n    elif not st or st.pop() != pair[c]:\n        ok = 0\n        break\nprint('YES' if ok and not st else 'NO')\n",
      javascript: "const s = require('fs').readFileSync(0, 'utf8').trim();\nconst st = [], pair = { ')': '(', ']': '[', '}': '{' };\nlet ok = 1;\nfor (const c of s) { if ('([{'.includes(c)) st.push(c); else if (st.pop() !== pair[c]) { ok = 0; break; } }\nconsole.log(ok && !st.length ? 'YES' : 'NO');\n",
    },
  },
  {
    id: 'palindrome-check', title: 'Mirror Word', difficulty: 'Easy', tags: ['strings', 'two-pointers'],
    statement:
`A word reads the same forward and backward in the arena's mirror hall.

Given a word of lowercase letters, print YES if it is a palindrome, NO otherwise.`,
    input_format: 'One line: a string of 1 to 80 lowercase letters.',
    output_format: 'A single line: YES or NO.',
    constraints: 'No spaces, no punctuation. Just letters.\n\nTime limit: 1.0 s',
    examples: [{ input: 'racecar\n', output: 'YES\n' }, { input: 'devunity\n', output: 'NO\n' }],
    tests: 8, seed: 44,
    gen: {
      make: (r) => { const half = Array.from({ length: ri(r, 1, 10) }, () => LOWER[ri(r, 0, 25)]); const h = half.join(''); const tail = r() < 0.5 ? h.split('').reverse().join('') : Array.from({ length: h.length }, () => LOWER[ri(r, 0, 25)]).join(''); return h + tail + '\n'; },
      solve: (inp) => { const s = inp.trim(); return s === [...s].reverse().join('') ? 'YES' : 'NO'; },
    },
    ref: {
      python: "import sys\ns = sys.stdin.read().strip()\nprint('YES' if s == s[::-1] else 'NO')\n",
      javascript: "const s = require('fs').readFileSync(0, 'utf8').trim();\nconsole.log(s === [...s].reverse().join('') ? 'YES' : 'NO');\n",
    },
  },
  {
    id: 'fib-mod', title: 'Fibonacci, Modulo the World', difficulty: 'Medium', tags: ['math', 'divide-and-conquer'],
    statement:
`Print the n-th Fibonacci number modulo m.

With n up to 10^18, iteration is hopeless. The intended path is **fast doubling**:

> F(2k) = F(k) * (2*F(k+1) - F(k))  
> F(2k+1) = F(k)^2 + F(k+1)^2

Everything stays under m squared, so 64-bit integers are safe when m <= 10^9.`,
    input_format: 'One line: integers n and m (0 <= n <= 10^18, 2 <= m <= 10^9).',
    output_format: 'One integer: F(n) mod m, with F(0) = 0, F(1) = 1.',
    constraints: '0 <= n <= 10^18\n2 <= m <= 10^9\n\nTime limit: 1.0 s',
    examples: [{ input: '10 1000\n', output: '55\n' }, { input: '4 7\n', output: '3\n', explanation: 'F(0..4) = 0, 1, 1, 2, 3 — and 3 mod 7 = 3.' }],
    tests: 7, seed: 55,
    gen: {
      make: (r) => (ri(r, 0, 10) > 7 ? Math.floor(r() * 1e18) : ri(r, 0, 30)) + ' ' + ri(r, 2, 1000000000) + '\n',
      solve: (inp) => {
        const [n, m] = inp.trim().split(/\s+/).map(BigInt);
        const fib = (k) => { if (k === 0n) return [0n, 1n]; const [a, b] = fib(k >> 1n); const c = (a * (((2n * b - a) % m) + m)) % m; const d = (a * a + b * b) % m; return k & 1n ? [d, (c + d) % m] : [c, d]; };
        return fib(n)[0].toString();
      },
    },
    ref: {
      python: 'import sys\nsys.setrecursionlimit(10000)\nn, m = map(int, sys.stdin.read().split())\ndef fib(k):\n    if k == 0:\n        return (0, 1)\n    a, b = fib(k >> 1)\n    c = a * ((2 * b - a) % m) % m\n    d = (a * a + b * b) % m\n    return (d, (c + d) % m) if k & 1 else (c, d)\nprint(fib(n)[0] % m)\n',
      javascript: "const [n0, m0] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(BigInt);\nfunction fib(k) { if (k === 0n) return [0n, 1n]; const [a, b] = fib(k >> 1n); const c = a * (((2n * b - a) % m0) + m0) % m0; const d = (a * a + b * b) % m0; return k & 1n ? [d, (c + d) % m0] : [c, d]; }\nconsole.log(fib(n0)[0].toString());\n",
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\ntypedef long long ll;\nll m;\npair<ll,ll> fib(ll k){ if(!k) return {0,1}; pair<ll,ll> f=fib(k>>1); ll a=f.first,b=f.second; ll c=a*(((2*b-a)%m+m)%m)%m; ll d=(a*a+b*b)%m; return k&1? make_pair(d,(c+d)%m): make_pair(c,d); }\nint main(){ ll n; cin>>n>>m; cout<<fib(n).first%m<<"\\n"; return 0; }\n',
      java: 'import java.util.*;\npublic class Main {\n  static long m;\n  static long[] fib(long k) {\n    if (k == 0) return new long[]{0, 1};\n    long[] p = fib(k >> 1); long a = p[0], b = p[1];\n    long c = a * (((2 * b - a) % m + m) % m) % m;\n    long d = (a * a + b * b) % m;\n    return (k & 1) == 1 ? new long[]{d, (c + d) % m} : new long[]{c, d};\n  }\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in); long n = sc.nextLong(); m = sc.nextLong();\n    System.out.println(fib(n)[0] % m);\n  }\n}\n',
    },
  },
  {
    id: 'gcd-pairs', title: 'Coprime Pairs', difficulty: 'Medium', tags: ['math', 'number-theory', 'brute force'],
    statement:
`Given an array of positive integers, count the pairs (i, j) with i < j such that gcd(a_i, a_j) = 1 — the **coprime** pairs.

The honest O(n^2) scan passes for n <= 500. Elegant sieves are welcome afterwards.`,
    input_format: 'First line: integer n (1 <= n <= 500). Second line: n integers a_1..a_n (1 <= a_i <= 1000).',
    output_format: 'One integer — the number of coprime pairs.',
    constraints: 'n <= 500, values <= 1000. The answer fits in 64 bits.\n\nTime limit: 1.5 s',
    examples: [{ input: '4\n2 3 4 9\n', output: '4\n', explanation: 'Pairs (2,3),(2,9),(3,4),(4,9).' }],
    tests: 6, seed: 66,
    gen: {
      make: (r) => { const n = ri(r, 2, 120); const a = Array.from({ length: n }, () => ri(r, 1, 1000)); return n + '\n' + a.join(' ') + '\n'; },
      solve: (inp) => {
        const d = inp.trim().split(/\s+/).map(Number); const n = d[0], a = d.slice(1, 1 + n);
        const g = (x, y) => (y ? g(y, x % y) : x);
        let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (g(a[i], a[j]) === 1) c++;
        return String(c);
      },
    },
    ref: {
      python: 'import sys, math\nd = sys.stdin.read().split()\nn = int(d[0])\na = list(map(int, d[1:1+n]))\ng = math.gcd\nprint(sum(1 for i in range(n) for j in range(i + 1, n) if g(a[i], a[j]) == 1))\n',
    },
  },
  {
    id: 'staircase-ways', title: 'The Three-Step Staircase', difficulty: 'Medium', tags: ['dp', 'math'],
    statement:
`You climb a staircase of n steps. At each move you may take 1, 2 or 3 steps. Count the distinct ways to reach the top.

Output the answer modulo 10^9 + 7.`,
    input_format: 'One integer n (1 <= n <= 100000).',
    output_format: 'One integer: the number of ways modulo 10^9 + 7.',
    constraints: 'ways(1)=1, ways(2)=2, ways(3)=4, ways(4)=7\n\nTime limit: 1.0 s',
    examples: [{ input: '4\n', output: '7\n', explanation: '1111, 112, 121, 211, 22, 13, 31.' }],
    tests: 6, seed: 77,
    gen: {
      make: (r) => ri(r, 1, 4000) + '\n',
      solve: (inp) => {
        const n = Number(inp.trim()); const M = 1000000007n;
        if (n === 1) return '1'; if (n === 2) return '2'; if (n === 3) return '4';
        let a = 1n, b = 2n, c = 4n;
        for (let i = 4; i <= n; i++) { const d = (a + b + c) % M; a = b; b = c; c = d; }
        return c.toString();
      },
    },
    ref: {
      python: 'import sys\nn = int(sys.stdin.read())\nMOD = 10**9 + 7\ndp = [1] + [0] * max(n, 3)\nfor i in range(1, n + 1):\n    dp[i] = sum(dp[max(0, i - k)] for k in (1, 2, 3)) % MOD\nprint(dp[n])\n',
    },
  },
  {
    id: 'prefix-sum-range', title: 'Range Queries at Scale', difficulty: 'Medium', tags: ['prefix sums', 'implementation'],
    statement:
`Static array, many questions: for each query l, r, print the sum of a[l..r] (1-indexed, inclusive).

An O(1) answer per query demands one O(n) preprocessing pass. That's the whole trick.`,
    input_format: 'Line 1: n (1 <= n <= 2*10^5). Line 2: n integers (|a_i| <= 10^6). Line 3: q (1 <= q <= 10^5). Next q lines: two integers l, r.',
    output_format: 'q lines — the answer to each query.',
    constraints: 'Sums fit in signed 64-bit.\n\nTime limit: 2.0 s',
    examples: [{ input: '5\n1 2 3 4 5\n2\n1 3\n2 5\n', output: '6\n14\n' }],
    tests: 5, seed: 88,
    gen: {
      make: (r) => {
        const n = ri(r, 2, 400); const a = Array.from({ length: n }, () => ri(r, -100, 100));
        const q = ri(r, 1, 40); const qs = [];
        for (let i = 0; i < q; i++) { const l = ri(r, 1, n), rr = ri(r, l, n); qs.push(l + ' ' + rr); }
        return n + '\n' + a.join(' ') + '\n' + q + '\n' + qs.join('\n') + '\n';
      },
      solve: (inp) => {
        const d = inp.trim().split(/\s+/).map(Number); let p = 0;
        const n = d[p++]; const a = d.slice(p, p + n); p += n;
        const ps = new Float64Array(n + 1); for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + a[i];
        const q = d[p++]; const out = [];
        for (let i = 0; i < q; i++) { const l = d[p++], rr = d[p++]; out.push(String(ps[rr] - ps[l - 1])); }
        return out.join('\n');
      },
    },
    ref: {
      python: 'import sys\nd = sys.stdin.buffer.read().split()\np = 0\nn = int(d[p]); p += 1\nps = [0]\nfor x in d[p:p+n]:\n    ps.append(ps[-1] + int(x))\np += n\nq = int(d[p]); p += 1\nout = []\nfor _ in range(q):\n    l = int(d[p]); r = int(d[p+1]); p += 2\n    out.append(str(ps[r] - ps[l-1]))\nprint("\\n".join(out))\n',
    },
  },
  {
    id: 'island-steps', title: 'Shortest Path Through the Isles', difficulty: 'Hard', tags: ['graphs', 'bfs'],
    statement:
`An island grid. Dot cells are walkable, hash cells are ocean walls, S is where you start, E is the portal.

Each move steps to an edge-adjacent walkable cell. Find the **minimum number of moves** to reach E, or print -1 if the isles are unreachable.`,
    input_format: 'First line: R and C (1 <= R, C <= 100). Next R lines: grid rows of exactly C characters. Exactly one S and one E exist.',
    output_format: 'One integer: minimum moves, or -1.',
    constraints: 'R, C <= 100 — BFS is enough for a comfortable margin.\n\nTime limit: 1.0 s',
    examples: [{ input: '3 4\nS..\n.##.\n..E.\n', output: '4\n', explanation: 'S -> (1,0) -> (2,0) -> (2,1) -> E.' }],
    tests: 7, seed: 99,
    gen: {
      make: (r) => {
        const R = ri(r, 3, 22), C = ri(r, 3, 22);
        const g = Array.from({ length: R }, () => Array.from({ length: C }, () => (r() < 0.28 ? '#' : '.')));
        g[0][0] = 'S'; g[R - 1][C - 1] = 'E'; g[0][1] = '.'; g[R - 1][C - 2] = '.';
        return R + ' ' + C + '\n' + g.map((x) => x.join('')).join('\n') + '\n';
      },
      solve: (inp) => {
        const [hd, ...grid] = inp.trim().split('\n'); const [R, C] = hd.split(' ').map(Number);
        let sx = 0, sy = 0;
        for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (grid[i][j] === 'S') { sx = i; sy = j; }
        const dist = Array.from({ length: R }, () => Array(C).fill(-1));
        const q = [[sx, sy]]; dist[sx][sy] = 0;
        for (let h = 0; h < q.length; h++) {
          const [x, y] = q[h];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= R || ny >= C || grid[nx][ny] === '#' || dist[nx][ny] !== -1) continue;
            dist[nx][ny] = dist[x][y] + 1; q.push([nx, ny]);
          }
        }
        return String(dist[R - 1][C - 1]);
      },
    },
    ref: {
      python: "import sys\nfrom collections import deque\nR, C = map(int, input().split())\ng = [list(input()) for _ in range(R)]\nq = deque()\nfor i in range(R):\n    for j in range(C):\n        if g[i][j] == 'S':\n            q.append((i, j, 0)); g[i][j] = '.'\nd = -1\nwhile q:\n    x, y, k = q.popleft()\n    if g[x][y] == 'E':\n        d = k\n        break\n    g[x][y] = '#'\n    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n        nx, ny = x + dx, y + dy\n        if 0 <= nx < R and 0 <= ny < C and g[nx][ny] != '#':\n            q.append((nx, ny, k + 1))\nprint(d)\n",
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ int R,C; cin>>R>>C; vector<string> g(R); for(auto&s:g)cin>>s;\n queue<tuple<int,int,int> > q; for(int i=0;i<R;i++)for(int j=0;j<C;j++)if(g[i][j]==\'S\'){q.emplace(i,j,0);g[i][j]=\'.\';}\n int d=-1; while(q.size()){ auto t=q.front(); q.pop(); int x=get<0>(t),y=get<1>(t),k=get<2>(t); if(g[x][y]==\'E\'){d=k;break;} g[x][y]=\'#\';\n for(auto p:vector<pair<int,int> >{{1,0},{-1,0},{0,1},{0,-1}}){int nx=x+p.first,ny=y+p.second; if(nx>=0&&ny>=0&&nx<R&&ny<C&&g[nx][ny]!=\'#\')q.emplace(nx,ny,k+1);} }\n cout<<d<<"\\n"; return 0; }\n',
    },
  },
  {
    id: 'lonely-bit', title: 'The Lonely Integer', difficulty: 'Medium', tags: ['bitmask', 'math'],
    statement:
`Every integer in the stream appears **exactly twice** — except one, the lonely one, which appears once. Find it.

x XOR x = 0. Everything else is bookkeeping.`,
    input_format: 'Line 1: odd n (1 <= n <= 200001). Line 2: n integers 0 <= a_i <= 10^9.',
    output_format: 'One integer — the lonely value.',
    constraints: 'Guaranteed: exactly one element has odd frequency.\n\nTime limit: 1.0 s',
    examples: [{ input: '5\n1 2 3 2 1\n', output: '3\n' }],
    tests: 6, seed: 101,
    gen: {
      make: (r) => {
        const k = ri(r, 1, 80); const vals = [];
        for (let i = 0; i < k; i++) { const v = ri(r, 0, 1000000000); vals.push(v, v); }
        vals.push(ri(r, 0, 1000000000));
        for (let i = vals.length - 1; i > 0; i--) { const j = ri(r, 0, i); const t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
        return vals.length + '\n' + vals.join(' ') + '\n';
      },
      solve: (inp) => { const d = inp.trim().split(/\s+/).slice(1); let x = 0; for (const v of d) x ^= Number(v); return String(x >>> 0); },
    },
    ref: {
      python: 'import sys\nd = sys.stdin.buffer.read().split()\nx = 0\nfor v in d[1:]:\n    x ^= int(v)\nprint(x)\n',
      javascript: "const d = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).slice(1);\nlet x = 0; for (const v of d) x ^= Number(v); console.log(x >>> 0);\n",
    },
  },
  {
    id: 'power-mod', title: 'Power Under the Modulus', difficulty: 'Medium', tags: ['math', 'binary exponentiation'],
    statement:
`Compute a^b mod m for huge b. Binary exponentiation needs log2(10^18) ≈ 60 multiplications, whatever the size of the empire.`,
    input_format: 'One line: integers a, b, m (1 <= a <= 10^9, 0 <= b <= 10^18, 2 <= m <= 10^9).',
    output_format: 'One integer: a^b mod m.',
    constraints: 'Use 64-bit products — (m-1)^2 < 10^18 fits.\n\nTime limit: 1.0 s',
    examples: [{ input: '2 10 1000\n', output: '24\n' }],
    tests: 6, seed: 202,
    gen: {
      make: (r) => ri(r, 1, 1000000000) + ' ' + Math.floor(r() * 1e18) + ' ' + ri(r, 2, 1000000000) + '\n',
      solve: (inp) => {
        const [a, b, m] = inp.trim().split(/\s+/).map(BigInt);
        let res = 1n, base = a % m, e = b;
        while (e > 0n) { if (e & 1n) res = res * base % m; base = base * base % m; e >>= 1n; }
        return res.toString();
      },
    },
    ref: {
      python: 'import sys\na, b, m = map(int, sys.stdin.read().split())\nprint(pow(a, b, m))\n',
      cpp: '#include <bits/stdc++.h>\nusing namespace std; typedef unsigned long long ull;\nint main(){ ull a,b,m; cin>>a>>b>>m; ull r=1%m, x=a%m; while(b){ if(b&1) r=(__uint128_t)r*x%m; x=(__uint128_t)x*x%m; b>>=1;} cout<<r<<"\\n"; return 0; }\n',
    },
  },
  {
    id: 'expedition-knapsack', title: 'Expedition Knapsack', difficulty: 'Hard', tags: ['dp', 'optimization'],
    statement:
`Your expedition can carry at most **W** units of weight. Among n relics (weight w_i, value v_i), maximize the value you take. Each relic is taken once or not at all.`,
    input_format: 'Line 1: n (1 <= n <= 100) and W (1 <= W <= 5000). Next n lines: w_i v_i (1 <= w_i <= W, 0 <= v_i <= 10^6).',
    output_format: 'One integer: maximum total value.',
    constraints: 'O(nW) suffices — that is 5*10^5 states.\n\nTime limit: 1.0 s',
    examples: [{ input: '3 8\n3 4\n5 6\n2 3\n', output: '9\n', explanation: 'Take relics 2+3 — weight 7 <= 8, value 9.' }],
    tests: 6, seed: 303,
    gen: {
      make: (r) => {
        const n = ri(r, 2, 40), W = ri(r, 5, 300);
        const items = Array.from({ length: n }, () => ri(r, 1, W) + ' ' + ri(r, 0, 10000));
        return n + ' ' + W + '\n' + items.join('\n') + '\n';
      },
      solve: (inp) => {
        const d = inp.trim().split(/\s+/).map(Number); const n = d[0], W = d[1];
        const dp = new Array(W + 1).fill(0);
        for (let i = 0; i < n; i++) { const wt = d[2 + 2 * i], val = d[3 + 2 * i]; for (let c = W; c >= wt; c--) dp[c] = Math.max(dp[c], dp[c - wt] + val); }
        return String(dp[W]);
      },
    },
    ref: {
      python: 'import sys\nd = list(map(int, sys.stdin.buffer.read().split()))\nn, W = d[0], d[1]\ndp = [0] * (W + 1)\np = 2\nfor _ in range(n):\n    wt, val = d[p], d[p + 1]\n    p += 2\n    for c in range(W, wt - 1, -1):\n        nv = dp[c - wt] + val\n        if nv > dp[c]:\n            dp[c] = nv\nprint(dp[W])\n',
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ int n,W; if(!(cin>>n>>W))return 0; vector<long long> dp(W+1);\n for(int i=0;i<n;i++){ int wt; long long val; cin>>wt>>val; for(int c=W;c>=wt;c--) dp[c]=max(dp[c],dp[c-wt]+val); }\n cout<<dp[W]<<"\\n"; return 0; }\n',
    },
  },
  {
    id: 'shared-subsequence', title: 'Longest Shared Subsequence', difficulty: 'Hard', tags: ['dp', 'strings'],
    statement:
`Given two lowercase strings, find the length of their **longest common subsequence** (characters need not be adjacent). The classic DP grid is the entry fee.`,
    input_format: 'Two lines: strings s and t (1 <= |s|, |t| <= 800).',
    output_format: 'One integer: LCS length.',
    constraints: 'Keep memory to two rows or you will pay for it.\n\nTime limit: 1.5 s',
    examples: [{ input: 'arena\nrage\n', output: '2\n', explanation: 'ra or re.' }],
    tests: 5, seed: 404,
    gen: {
      make: (r) => {
        const mk = () => Array.from({ length: ri(r, 2, 180) }, () => LOWER[ri(r, 0, 25)]).join('');
        return mk() + '\n' + mk() + '\n';
      },
      solve: (inp) => {
        const [s, t] = inp.trim().split('\n'); const n = s.length, m = t.length;
        let prev = new Uint16Array(m + 1), cur = new Uint16Array(m + 1);
        for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= m; j++) cur[j] = s[i - 1] === t[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
          const tmp = prev; prev = cur; cur = tmp; cur.fill(0);
        }
        return String(prev[m]);
      },
    },
    ref: {
      python: 'import sys\ns, t = sys.stdin.read().split()\nn, m = len(s), len(t)\nprev = [0] * (m + 1)\nfor i in range(1, n + 1):\n    cur = [0]\n    si = s[i - 1]\n    for j in range(1, m + 1):\n        cur.append(prev[j - 1] + 1 if si == t[j - 1] else max(prev[j], cur[-1]))\n    prev = cur\nprint(prev[m])\n',
    },
  },
  {
    id: 'signal-delay', title: 'Signal Delay', difficulty: 'Hard', tags: ['graphs', 'shortest paths', 'dijkstra'],
    statement:
`n routers, m directed cables with propagation delay w. A signal is injected at router **1**. When is the earliest it can reach router n?

Dijkstra with a priority queue. Print -1 if the network never connects.`,
    input_format: 'Line 1: n (2 <= n <= 5000) and m (1 <= m <= 20000). Next m lines: u v w (1 <= u,v <= n, 1 <= w <= 10^6).',
    output_format: 'One integer: earliest arrival at router n, or -1.',
    constraints: 'Total weight <= 2*10^10 — 64-bit distances.\n\nTime limit: 2.0 s',
    examples: [{ input: '4 4\n1 2 2\n2 4 5\n1 3 3\n3 4 1\n', output: '4\n', explanation: '1->3->4 beats 1->2->4.' }],
    tests: 6, seed: 505,
    gen: {
      make: (r) => {
        const n = ri(r, 2, 90), m = ri(r, 2, 200); const e = [];
        for (let i = 0; i < m; i++) e.push(ri(r, 1, n) + ' ' + ri(r, 1, n) + ' ' + ri(r, 1, 100000));
        if (r() < 0.8) e.push('1 ' + n + ' ' + ri(r, 1, 100000));
        return n + ' ' + m + '\n' + e.join('\n') + '\n';
      },
      solve: (inp) => {
        const d = inp.trim().split(/\s+/).map(Number); let p = 0; const n = d[p++], m = d[p++];
        const adj = Array.from({ length: n + 1 }, () => []);
        for (let i = 0; i < m; i++) { const u = d[p++], v = d[p++], w = d[p++]; adj[u].push([v, w]); }
        const dist = new Array(n + 1).fill(Infinity); dist[1] = 0;
        const pq = [[0, 1]];
        while (pq.length) {
          pq.sort((a, b) => a[0] - b[0]);
          const [k, u] = pq.shift();
          if (k > dist[u]) continue;
          for (const [v, w] of adj[u]) if (k + w < dist[v]) { dist[v] = k + w; pq.push([dist[v], v]); }
        }
        return dist[n] === Infinity ? '-1' : String(dist[n]);
      },
    },
    ref: {
      python: 'import sys, heapq\ndata = sys.stdin.buffer.read().split()\np = 0\nn = int(data[p]); p += 1\nm = int(data[p]); p += 1\nadj = [[] for _ in range(n + 1)]\nfor _ in range(m):\n    u = int(data[p]); v = int(data[p + 1]); w = int(data[p + 2]); p += 3\n    adj[u].append((v, w))\nINF = 10**30\ndist = [INF] * (n + 1)\ndist[1] = 0\npq = [(0, 1)]\nwhile pq:\n    k, u = heapq.heappop(pq)\n    if k > dist[u]:\n        continue\n    for v, w in adj[u]:\n        if k + w < dist[v]:\n            dist[v] = k + w\n            heapq.heappush(pq, (dist[v], v))\nprint(-1 if dist[n] == INF else dist[n])\n',
    },
  },
];

export const COLLEGES = [
  ['c-01', 'IIT Delhi', 'IITD', 'New Delhi'],
  ['c-02', 'DTU', 'DTU', 'Delhi'],
  ['c-03', 'NSUT', 'NSUT', 'Delhi'],
  ['c-04', 'IIIT Delhi', 'IIITD', 'New Delhi'],
  ['c-05', 'NIT Trichy', 'NITT', 'Tiruchirappalli'],
  ['c-06', 'VIT Vellore', 'VIT', 'Vellore'],
  ['c-07', 'BITS Pilani', 'BITS', 'Pilani'],
  ['c-08', 'Thapar Institute', 'TIET', 'Patiala'],
  ['c-09', 'MNIT Jaipur', 'MNIT', 'Jaipur'],
  ['c-10', 'VSSUT Burla', 'VSSUT', 'Burla'],
].map(([id, name, code, city]) => ({ id, name, code, city }));

export const USERS = [
  ['vansh', 'Vansh Agarwal', 'admin'],
  ['aarav', 'Aarav Mehta'],
  ['meera.codes', 'Meera Iyer'],
  ['nullp0inter', 'Rohan Das'],
  ['sushmita', 'Sushmita Rao'],
  ['k1ng', 'Arjun Khanna'],
  ['vixit', 'Vixit Sharma'],
  ['rad1x', 'Priya Nair'],
  ['tannya', 'Tannya Gupta'],
  ['ironravi', 'Ravi Teja'],
  ['zoya.dev', 'Zoya Sheikh'],
  ['mon0tone', 'Devansh Jain'],
].map(([handle, name, role]) => ({ handle, name, role: role || 'user', college: COLLEGES[(handle.length * 7919) % COLLEGES.length].id }));

export const ACHIEVEMENTS = [
  ['first_blood', 'First Blood', 'Get your first Accepted verdict.'],
  ['solver_10', 'Ten Down', 'Solve 10 distinct problems.'],
  ['solver_50', 'Fifty Strong', 'Solve 50 distinct problems.'],
  ['hard_solver', 'Into the Fire', 'Solve a Hard-rated problem.'],
  ['polyglot', 'Polyglot', 'Get Accepted in three different languages.'],
  ['contest_win', 'Champion', 'Finish 1st in a rated contest.'],
  ['top10', 'Top Ten', 'Place in the top 10 of a contest.'],
  ['expert', 'Expert', 'Reach a rating of 1600+.'],
  ['candidate_master', 'Candidate Master', 'Reach a rating of 1900+.'],
  ['master', 'Master', 'Reach a rating of 2100+.'],
  ['night_owl', 'Night Owl', 'Submit between 00:00 and 05:00.'],
  ['consistency', 'Daily Grind', 'Accept solutions on 7 different days.'],
];
