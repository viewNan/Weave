CREATE TABLE IF NOT EXISTS practice_question_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL UNIQUE
);

-- Keep allocations even if a future tool permanently removes a question.
INSERT OR IGNORE INTO practice_question_numbers (item_id)
SELECT i.id FROM practice_items i
JOIN practice_groups g ON g.id=i.group_id
JOIN practice_sets s ON s.id=g.set_id
ORDER BY s.created_at,s.id,g.sort_order,g.id,i.sort_order,i.id;

CREATE TRIGGER IF NOT EXISTS practice_items_allocate_number
AFTER INSERT ON practice_items
BEGIN
  INSERT INTO practice_question_numbers (item_id) VALUES (NEW.id);
END;
