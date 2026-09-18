ALTER TABLE morning_briefs ADD COLUMN items_json TEXT;

CREATE TABLE IF NOT EXISTS morning_brief_generation_locks (
  brief_date TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL
);
