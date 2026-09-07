import { config } from '../config.js';

/**
 * Language toolchains for the sandboxed runner.
 * `run(ml)` may take the memory limit to derive JVM/heap flags.
 */
export const LANGS = {
  python: {
    id: 'python', label: 'Python 3', ext: 'py', file: 'main.py',
    monaco: 'python',
    run: () => ['python3', '-I', '-S', '-B', 'main.py'],
    as: true, pad: 180,
    starter: `import sys

def main():
    data = sys.stdin.buffer.read().decode()
    # solve here
    print()

if __name__ == "__main__":
    main()
`,
  },
  javascript: {
    id: 'javascript', label: 'Node.js', ext: 'js', file: 'main.js',
    monaco: 'javascript',
    run: (ml) => ['node', `--max-old-space-size=${ml}`, 'main.js'],
    as: false, pad: 0,
    starter: `const fs = require('fs');
const data = fs.readFileSync(0, 'utf8');

// solve here
console.log();
`,
  },
  cpp: {
    id: 'cpp', label: 'C++17', ext: 'cpp', file: 'main.cpp',
    monaco: 'cpp',
    compile: (ml) => ['g++', '-O2', '-std=gnu++17', '-pipe', '-w', 'main.cpp', '-o', 'main'],
    run: () => ['./main'],
    as: true, pad: 60,
    starter: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
  },
  java: {
    id: 'java', label: 'Java 11', ext: 'java', file: 'Main.java',
    monaco: 'java',
    compile: () => ['javac', '-encoding', 'UTF-8', 'Main.java'],
    run: (ml) => ['java', '-Xmx' + ml + 'm', '-Xss64m', '-XX:+ExitOnOutOfMemoryError',
                  '-XX:-UsePerfData', '-Djava.io.tmpdir=.', '-cp', '.', 'Main'],
    as: false, pad: 0,
    starter: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();

        System.out.println(sb.toString().trim());
    }
}
`,
  },
};

export const LANG_KEYS = Object.keys(LANGS);
