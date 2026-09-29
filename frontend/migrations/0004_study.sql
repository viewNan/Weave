CREATE TABLE IF NOT EXISTS study_items (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS study_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), focus_min_minutes INTEGER NOT NULL DEFAULT 25,
  focus_max_minutes INTEGER NOT NULL DEFAULT 50, break_min_minutes INTEGER NOT NULL DEFAULT 5,
  break_max_minutes INTEGER NOT NULL DEFAULT 12, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS study_rounds (
  id TEXT PRIMARY KEY, study_item_id TEXT REFERENCES study_items(id) ON DELETE SET NULL,
  study_title TEXT NOT NULL, planned_focus_minutes INTEGER NOT NULL, planned_break_minutes INTEGER NOT NULL,
  actual_focus_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, drawn_at TEXT NOT NULL,
  focus_started_at TEXT, focus_ends_at TEXT, paused_at TEXT, paused_remaining_seconds INTEGER,
  focus_finished_at TEXT, break_started_at TEXT, break_ends_at TEXT, completed_at TEXT, abandoned_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS study_rounds_status_idx ON study_rounds (status, drawn_at DESC);
CREATE INDEX IF NOT EXISTS study_rounds_drawn_idx ON study_rounds (drawn_at DESC);
