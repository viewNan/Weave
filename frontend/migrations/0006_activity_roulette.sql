ALTER TABLE study_items ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'study';
ALTER TABLE study_items ADD COLUMN planned_duration_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE study_rounds ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'study';
ALTER TABLE study_suggestions ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'study';
ALTER TABLE study_suggestions ADD COLUMN planned_duration_minutes INTEGER NOT NULL DEFAULT 30;
CREATE TABLE IF NOT EXISTS study_session_state (id INTEGER PRIMARY KEY CHECK (id = 1), fatigue_level INTEGER NOT NULL DEFAULT 0, consecutive_load_count INTEGER NOT NULL DEFAULT 0, recent_completed_activity_id TEXT, recent_completed_activity_type TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO study_session_state (id) VALUES (1);
INSERT OR IGNORE INTO study_suggestions (id,title,activity_type,planned_duration_minutes,sort_order) VALUES ('relax-walk','散步','relax',10,100),('relax-tea','泡茶','relax',10,101),('relax-music','听音乐','relax',15,102),('relax-stretch','伸展','relax',10,103),('relax-rest','闭眼休息','relax',10,104);
