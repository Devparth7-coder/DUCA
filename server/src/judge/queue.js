/**
 * In-process submission queue. Judging runs outside the request handler,
 * bounded by JUDGE_CONCURRENCY slots. Jobs are submission ids persisted in the
 * DB, so pending work survives an API restart (re-enqueued at boot).
 */
export class JudgeQueue {
  constructor(concurrency, handler) {
    this.conc = Math.max(1, concurrency);
    this.handler = handler;
    this.q = [];
    this.active = 0;
  }

  push(job) { this.q.push(job); setImmediate(() => this.pump()); }

  pump() {
    while (this.active < this.conc && this.q.length) {
      const job = this.q.shift();
      this.active++;
      Promise.resolve()
        .then(() => this.handler(job))
        .catch((e) => console.error('[judge] handler error', e))
        .finally(() => { this.active--; this.pump(); });
    }
  }

  get depth() { return this.q.length + this.active; }
}
