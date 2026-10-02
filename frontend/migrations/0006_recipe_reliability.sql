-- Keep older duplicates for audit, but expose one active daily meal.
ALTER TABLE meal_logs ADD COLUMN archived_at TEXT;
ALTER TABLE meal_logs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meal_logs ADD COLUMN recommendation_date TEXT;
ALTER TABLE meal_logs ADD COLUMN candidate_index INTEGER;
UPDATE meal_logs SET archived_at = CURRENT_TIMESTAMP WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY meal_date ORDER BY created_at DESC, id DESC) AS position
    FROM meal_logs
  ) WHERE position > 1
);
CREATE UNIQUE INDEX meal_logs_active_date ON meal_logs(meal_date) WHERE archived_at IS NULL;

-- Existing recommendations have unknown provenance; do not relabel them as AI output.
ALTER TABLE daily_recipe_recommendations ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE daily_recipe_recommendations ADD COLUMN context_json TEXT;
ALTER TABLE daily_recipe_recommendations ADD COLUMN model_response_id TEXT;
CREATE TABLE recipe_generation_runs (
  recommendation_date TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','failed','completed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_code TEXT
);
CREATE TABLE recipe_login_attempts (slot TEXT PRIMARY KEY, attempts INTEGER NOT NULL);
