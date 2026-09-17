CREATE TABLE IF NOT EXISTS morning_brief_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  weekday_categories_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS morning_briefs (
  brief_date TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  speech_text TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  manually_edited_at TEXT,
  shortcut_last_accessed_at TEXT,
  push_status TEXT NOT NULL DEFAULT 'pending',
  push_accepted INTEGER NOT NULL DEFAULT 0,
  push_rejected INTEGER NOT NULL DEFAULT 0,
  push_invalidated INTEGER NOT NULL DEFAULT 0,
  push_sent_at TEXT
);

INSERT OR IGNORE INTO morning_brief_settings (id, timezone, weekday_categories_json, updated_at)
VALUES (1, 'Asia/Tokyo', '{"1":["ai_tech","japan_life","international","developer"],"2":["ai_tech","japan_life","international","developer"],"3":["ai_tech","japan_life","international","developer"],"4":["ai_tech","japan_life","international","developer"],"5":["ai_tech","japan_life","international","developer"],"6":["ai_tech","science_space","games_culture"],"0":["weekly_review","next_week_watch","science_space","games_culture"]}', datetime('now'));
