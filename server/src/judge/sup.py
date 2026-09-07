#!/usr/bin/env python3
"""CodeArena supervisor: applies rlimits, runs the candidate, records wall time + peak RSS.

Invoked as:  python3 sup.py '<config-json>' -- <cmd> [args...]
Writes a result JSON file (config["out"]) that the Node runner reads back.
"""
import json
import os
import resource
import signal
import subprocess
import sys
import time


def main():
    argv = sys.argv[1:]
    sep = argv.index('--')
    cfg = json.loads(argv[0])
    cmd = argv[sep + 1:]

    out = cfg["out"]
    cpu_s = int(cfg.get("cpu_s", 3))
    wall_ms = int(cfg.get("wall_ms", 4000))
    mem_b = int(cfg.get("mem_mb", 256)) * 1024 * 1024
    apply_as = int(cfg.get("as", 1)) == 1

    def limits():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_s, cpu_s + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))   # no files written
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))    # no cores
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        if apply_as:
            try:
                resource.setrlimit(resource.RLIMIT_AS, (mem_b, mem_b))
            except Exception:
                pass

    t0 = time.monotonic()
    timed_out = 0
    exit_code = None
    signal_no = 0
    try:
        p = subprocess.Popen(cmd, preexec_fn=limits)
        try:
            status = p.wait(timeout=wall_ms / 1000.0)
            if status < 0:
                signal_no = -status
                exit_code = 128 + signal_no
            else:
                exit_code = status
        except subprocess.TimeoutExpired:
            timed_out = 1
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except Exception:
                pass
            try:
                p.wait(timeout=2)
            except Exception:
                pass
    except Exception as e:
        with open(out, "w") as f:
            json.dump({"error": str(e)}, f)
        sys.exit(2)

    ru = resource.getrusage(resource.RUSAGE_CHILDREN)
    res = {
        "exit": exit_code,
        "signal": signal_no,
        "tle": timed_out or (signal_no in (24, 25) or exit_code in (152, 137)),  # SIGXCPU/XFSZ
        "time_ms": round((time.monotonic() - t0) * 1000),
        "mem_kb": int(ru.ru_maxrss),  # KB on Linux
    }
    with open(out, "w") as f:
        json.dump(res, f)


if __name__ == "__main__":
    main()
