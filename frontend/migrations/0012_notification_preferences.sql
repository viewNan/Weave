CREATE TABLE notification_preferences (
  activity TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);
