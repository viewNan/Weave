CREATE TABLE IF NOT EXISTS study_daily_budgets (
  activity_id TEXT NOT NULL REFERENCES study_items(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  total_minutes INTEGER NOT NULL,
  completed_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (activity_id, local_date)
);

CREATE INDEX IF NOT EXISTS idx_study_daily_budgets_date ON study_daily_budgets(local_date);
