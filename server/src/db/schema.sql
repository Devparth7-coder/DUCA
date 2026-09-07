CREATE TABLE IF NOT EXISTS colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  college_id TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  bio TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'IN',
  rating INTEGER NOT NULL DEFAULT 1500,
  peak INTEGER NOT NULL DEFAULT 1500,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  statement TEXT NOT NULL DEFAULT '',
  input_format TEXT NOT NULL DEFAULT '',
  output_format TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  examples TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  tests TEXT NOT NULL DEFAULT '[]',
  tl_ms INTEGER NOT NULL DEFAULT 2000,
  ml_mb INTEGER NOT NULL DEFAULT 256,
  starter TEXT NOT NULL DEFAULT '{}',
  author_id TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS contests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  start_at BIGINT NOT NULL,
  end_at BIGINT NOT NULL,
  penalty_min INTEGER NOT NULL DEFAULT 20,
  rated INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT 'A'
);

CREATE TABLE IF NOT EXISTS contest_registrations (
  contest_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (contest_id, user_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  contest_id TEXT,
  lang TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  passed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  mem_kb INTEGER NOT NULL DEFAULT 0,
  err TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL,
  judged_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rating_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contest_id TEXT NOT NULL,
  old_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  computed_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  flavor TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  earned_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sub_prob ON submissions (problem_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_contest ON submissions (contest_id, status);
CREATE INDEX IF NOT EXISTS idx_rating_user ON rating_events (user_id, computed_at);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users (rating DESC);
