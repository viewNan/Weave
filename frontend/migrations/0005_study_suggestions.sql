CREATE TABLE IF NOT EXISTS study_suggestions (
  id TEXT PRIMARY KEY, title TEXT NOT NULL COLLATE NOCASE UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO study_suggestions (id,title,sort_order) VALUES
  ('preset-apply','投递公司',0),('preset-japanese','面试日语练习',1),('preset-weave','开发 Weave',2),
  ('preset-glasses','眼镜开发',3),('preset-test','网测',4),('preset-review','考试复习',5);
