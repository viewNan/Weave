CREATE TABLE IF NOT EXISTS practice_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS practice_groups (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES practice_sets(id),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  UNIQUE (set_id, name_key)
);
CREATE TABLE IF NOT EXISTS practice_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES practice_groups(id),
  prompt TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  outline TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0,1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 0,
  UNIQUE (group_id, prompt_key)
);
CREATE TABLE IF NOT EXISTS practice_attempts (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES practice_items(id),
  rating TEXT CHECK (rating IN ('fluent','shaky','unknown')),
  note TEXT NOT NULL DEFAULT '',
  study_day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0,1))
);
CREATE INDEX IF NOT EXISTS practice_attempts_item_day ON practice_attempts(item_id, study_day, deleted, sequence);
CREATE INDEX IF NOT EXISTS practice_attempts_item_latest ON practice_attempts(item_id, deleted, sequence);
