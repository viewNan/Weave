CREATE TABLE IF NOT EXISTS recipe_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id TEXT REFERENCES recipe_categories(id) ON DELETE SET NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  minutes INTEGER,
  difficulty TEXT,
  servings TEXT,
  markdown TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id TEXT PRIMARY KEY,
  meal_date TEXT NOT NULL,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  meal_name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('recommended', 'library', 'freeform')),
  feedback TEXT CHECK (feedback IN ('liked', 'neutral', 'disliked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_recipe_recommendations (
  recommendation_date TEXT PRIMARY KEY,
  candidates_json TEXT NOT NULL,
  selected_index INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL,
  push_status TEXT NOT NULL DEFAULT 'pending',
  push_sent_at TEXT
);

CREATE TABLE IF NOT EXISTS food_preferences (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  affinity REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  observation_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subject, source)
);

CREATE INDEX IF NOT EXISTS meal_logs_date_idx ON meal_logs (meal_date DESC);
CREATE INDEX IF NOT EXISTS recipes_category_idx ON recipes (category_id);
